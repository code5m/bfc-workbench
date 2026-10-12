import {createServer} from 'node:http';
import {readFile,writeFile,rename,chmod,appendFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {homedir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deriveWorkflow,pageVideos,validTopic,TARGETS} from './lib/workflow.mjs';
import {assessCompletion} from './lib/completion.mjs';
import {auditStrategy} from './lib/strategy-audit.mjs';
import {buildLocalCatalogFromDir,saveLocalCatalog} from './lib/local-catalog.mjs';
import {UnifiedExecutor} from './lib/unified-executor.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.BILIBILI_FAVORITES_DATA_DIR || join(homedir(),'Documents','Bilibili-Favorites-Review');
const host='127.0.0.1',port=Number(process.env.PORT||4198);
const csrf=randomBytes(32).toString('hex');
const executor=new UnifiedExecutor({dataDir,batchSize:40});
const readJson=async(name)=>{try{return JSON.parse(await readFile(join(dataDir,name),'utf8'));}catch{return null;}};

export function summarize({inventory,classification,guard,copy,desc}={}){
 const records=inventory?.members||[], folders=inventory?.folder_status||[], topics=classification?.summary?.categories||{};
 const completed=copy?.copied||{},blocked=guard?.status==='blocked';
 const classified=Object.values(topics).reduce((sum,n)=>sum+Number(n||0),0);
 return {
  updatedAt:new Date().toISOString(),status:blocked?'platform_access_blocked':'local_readonly',
  accountMutationsEnabled:false,
  snapshot:{memberships:records.length,distinctBvids:new Set(records.map(x=>x.bvid).filter(Boolean)).size,complete:inventory?.complete===true},
  classification:{categorized:classified,review:classification?.summary?.review||0,invalid:classification?.summary?.invalid||0,byTopic:topics,descriptionSuggestions:desc?.summary?.additional_review_suggestions||0},
  sync:{historicalCopies:Object.values(completed).reduce((sum,n)=>sum+Number(n||0),0),phase2Verified:0,note:'历史成功写入与本地分类建议不等于第二轮同步完成'},
  access:{blocked,reason:blocked?String(guard?.reason||'unknown'):null,requireReview:blocked},
  folders:folders.map(x=>({name:String(x.title||''),read:Number(x.retrieved||0),reported:Number(x.reported||0),nextPage:Number(x.last_page||1),complete:x.exhausted===true,lastError:x.last_error||null})),
  actionQueue:[
   {title:'本地分类与复核',status:classified>0?'working':'pending',detail:'可离线继续，不需要请求 B站'},
   {title:'平台正常授权访问确认',status:blocked?'blocked':'pending',detail:blocked?'HTTP 412 账号级暂停保护生效':'需正常授权并通过真实回读验收'},
   {title:'完整读取全部可见收藏',status:inventory?.complete?'done':'pending',detail:'继续记录未完成目录和断点'},
   {title:'第二轮账号同步',status:'pending',detail:'必须具备获授权的写入工具及回读验收'}
  ]
 };
}

async function readSources(){
 const [inventory,classification,guard,copy,desc,overrides,finalEvidence]=await Promise.all([
  readJson('inventory-rescan-v2.json'),readJson('v3-classification.json'),
  readJson('account-access-guard.json'),readJson('copy-summary.json'),
  readJson('description-review.json'),readJson('manual-review-overrides.json'),
  readJson('final-acceptance-evidence.json')
 ]);
 return {inventory,classification,guard,copy,desc,overrides,finalEvidence};
}
export async function snapshot(){
 const src=await readSources();
 const summary=summarize(src);
 const workflow=deriveWorkflow({inventory:src.inventory,classification:src.classification,
   description:src.desc,overrides:src.overrides,guard:src.guard,copySummary:src.copy});
 summary.workflow={stats:workflow.stats,milestones:workflow.milestones};
 summary.completion=assessCompletion({inventory:src.inventory,workflow,guard:src.guard,finalEvidence:src.finalEvidence});
 summary.strategyAudit=auditStrategy({inventory:src.inventory,guard:src.guard,classification:src.classification});
 summary.executor=await executor.status();
 return summary;
}
async function getWorkflow(){
 const src=await readSources();
 return deriveWorkflow({inventory:src.inventory,classification:src.classification,
  description:src.desc,overrides:src.overrides,guard:src.guard,copySummary:src.copy});
}
const mime={'/':'text/html; charset=utf-8','/app.js':'application/javascript; charset=utf-8','/local-library.js':'application/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'};
const assets={'/':'index.html','/app.js':'app.js','/local-library.js':'local-library.js','/style.css':'style.css'};
function sendJson(res,code,obj,extra={}){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(obj));
}
async function loadSmallBody(req){
 let size=0;const parts=[];
 for await(const ch of req){
  size+=ch.length;if(size>4096)throw new Error('request_body_too_large');
  parts.push(ch);
 }
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Error('invalid_json');}
}
async function atomicJson(path,data){
 const temp=path+'.tmp-'+process.pid;
 await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});
 await chmod(temp,0o600);await rename(temp,path);
}
async function exportReview(){
 const overrides=await readJson('manual-review-overrides.json')||{version:1,decisions:{}};
 const flow=await getWorkflow();
 return {version:1,type:'local_review_backup',generatedAt:new Date().toISOString(),decisions:overrides.decisions,
         count:Object.keys(overrides.decisions).length,accountWrites:0,blocked:flow.blocked};
}
async function auditOverview(){
 const flow=await getWorkflow();
 let logs=[];
 try{logs=(await readFile(join(dataDir,'local-review-audit.jsonl'),'utf8')).trim().split('\n').filter(Boolean).slice(-35).map(x=>{
   try{return JSON.parse(x)}catch{return {action:'unreadable_audit_line'}} }).reverse();}catch{}
 return {logs,guard:{blocked:flow.blocked,reason:flow.reason},localApproved:flow.stats.manual,
         unreviewed:flow.stats.conflict+flow.stats.unclassified+flow.stats.descriptionReview};
}
async function restoreReview(input){
 if(!input||input.type!=='local_review_backup'||input.version!==1||!input.decisions||typeof input.decisions!=='object'||Array.isArray(input.decisions))throw new Error('invalid_review_backup');
 const entries=Object.entries(input.decisions);
 if(entries.length>50)throw new Error('too_many_entries_for_small_body');
 const flow=await getWorkflow(),valid=new Set(flow.videos.filter(x=>x.decision!=='invalid').map(x=>x.bvid));
 const clean=Object.create(null);
 for(const [bvid,d] of entries){
  if(!/^BV[0-9a-zA-Z]{8,20}$/.test(bvid)||!valid.has(bvid)||!validTopic(d?.topic))throw new Error('invalid_review_entry');
  clean[bvid]={topic:d.topic,updatedAt:new Date().toISOString(),source:'local_review_backup_restore'};
 }
 const old=await readJson('manual-review-overrides.json')||{version:1,decisions:{}};
 await atomicJson(join(dataDir,'manual-review-backup-previous.json'),old);
 await atomicJson(join(dataDir,'manual-review-overrides.json'),{version:1,decisions:clean});
 const log=join(dataDir,'local-review-audit.jsonl');
 await appendFile(log,JSON.stringify({when:new Date().toISOString(),action:'restore_local_review_backup',count:entries.length})+'\n',{mode:0o600});
 return {ok:true,restored:entries.length,previousBackupAvailable:true,accountWrites:0};
}
let reviewQueue=Promise.resolve();
async function saveReview(input){
 const op=reviewQueue.then(async()=>{
  if(!input||typeof input!=='object')throw new Error('invalid_input');
  const bvid=input.bvid,topic=input.topic;
  if(typeof bvid!=='string'||!/^BV[0-9a-zA-Z]{8,20}$/.test(bvid))throw new Error('invalid_bvid');
  if(topic!==null&&!validTopic(topic))throw new Error('invalid_topic');
  const workflow=await getWorkflow();
  const item=workflow.videos.find(v=>v.bvid===bvid);
  if(!item||item.decision==='invalid')throw new Error('unreviewable_video');
  const existing=await readJson('manual-review-overrides.json')||{version:1,decisions:{}};
  if(existing.version!==1||!existing.decisions||typeof existing.decisions!=='object')throw new Error('invalid_store');
  const when=new Date().toISOString();
  if(topic===null)delete existing.decisions[bvid];
  else existing.decisions[bvid]={topic,updatedAt:when,source:'human_review_via_local_workbench'};
  await atomicJson(join(dataDir,'manual-review-overrides.json'),existing);
  const log=join(dataDir,'local-review-audit.jsonl');
  await appendFile(log,JSON.stringify({when,bvid,action:topic===null?'clear_local_review':'approve_local_topic',topic})+'\n',{mode:0o600});
  await chmod(log,0o600);
  return {ok:true,bvid,topic};
 });
 reviewQueue=op.catch(()=>{});
 return op;
}
function localhostOk(req){
 const addr=req.headers.host||'';
 return addr==='127.0.0.1:'+req.socket.localPort;
}
function reviewAuth(req){
 const origin='http://127.0.0.1:'+req.socket.localPort;
 return req.headers.origin===origin &&
   req.headers['content-type']?.split(';')[0]==='application/json' &&
   req.headers['x-local-csrf']===csrf;
}

export function createApp(){
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if(!localhostOk(req)){res.writeHead(403);res.end('Localhost only');return;}
  const url=new URL(req.url||'/','http://127.0.0.1');
  const route=url.pathname;
  try{
   if(req.method==='GET'&&route==='/api/status'){sendJson(res,200,await snapshot());return;}
   if(req.method==='GET'&&route==='/api/completion'){sendJson(res,200,(await snapshot()).completion);return;}
   if(req.method==='GET'&&route==='/api/strategy-audit'){sendJson(res,200,(await snapshot()).strategyAudit);return;}
   if(req.method==='GET'&&route==='/api/local-catalog'){
    const c=await buildLocalCatalogFromDir(dataDir);
    sendJson(res,200,{totals:c.totals,categories:c.categories,unobserved:c.unobserved,folders:c.folders});return;
   }
   if(req.method==='GET'&&route==='/api/local-catalog/items'){
    const c=await buildLocalCatalogFromDir(dataDir);
    const category=url.searchParams.get('category')||'';
    const state=url.searchParams.get('state')||'';
    const page=Math.max(1,Math.min(1000,parseInt(url.searchParams.get('page')||'1',10)||1));
    const query=(url.searchParams.get('q')||'').toLocaleLowerCase('zh-CN').slice(0,90);
    const rows=c.records.filter(v=>(!category||v.topic===category)&&(!state||v.localReviewState===state)&&(!query||v.title.toLocaleLowerCase('zh-CN').includes(query)||v.bvid.toLowerCase().includes(query)));
    sendJson(res,200,{total:rows.length,page,items:rows.slice((page-1)*25,page*25)});return;
   }
   if(req.method==='POST'&&route==='/api/local-catalog/rebuild'){
    if(!reviewAuth(req)){sendJson(res,403,{error:'csrf_or_origin_mismatch'});return;}
    const c=await buildLocalCatalogFromDir(dataDir);
    const file=await saveLocalCatalog(dataDir,c);
    sendJson(res,200,{ok:true,totals:c.totals,localOnly:true});return;
   }
   if(req.method==='GET'&&route==='/api/review/export'){sendJson(res,200,await exportReview(),{'Content-Disposition':'attachment; filename="bilibili-local-reviews.json"'});return;}
   if(req.method==='GET'&&route==='/api/audit'){sendJson(res,200,await auditOverview());return;}
   if(req.method==='GET'&&route==='/api/executor'){sendJson(res,200,await executor.status());return;}
   if(req.method==='POST'&&route==='/api/executor/action'){
    if(!reviewAuth(req)){sendJson(res,403,{error:'csrf_or_origin_mismatch'});return;}
    try{
     const request=await loadSmallBody(req);let result;
     switch(request?.action){
      case 'prepare': result=await executor.prepare(await getWorkflow());break;
      case 'start': result=await executor.start();break;
      case 'pause': result=await executor.pause();break;
      case 'resume': result=await executor.resume();break;
      case 'cancel': result=await executor.cancel();break;
      default:sendJson(res,400,{error:'unknown_executor_action'});return;
     }
     sendJson(res,200,result);
    }catch(e){sendJson(res,409,{error:String(e.message).slice(0,160)});}
    return;
   }
   if(req.method==='GET'&&route==='/api/health'){sendJson(res,200,{ok:true,localOnly:true,bilibiliNetworkRequests:0});return;}
   if(req.method==='POST'&&route==='/api/review/restore'){
    if(!reviewAuth(req)){sendJson(res,403,{error:'csrf_or_origin_mismatch'});return;}
    try{const input=await loadSmallBody(req);sendJson(res,200,await restoreReview(input));}
    catch(e){sendJson(res,400,{error:e.message});}return;
   }
   if(req.method==='GET'&&route==='/api/session'){sendJson(res,200,{token:csrf,categories:Object.keys(TARGETS)});return;}
   if(req.method==='GET'&&route==='/api/videos'){
    const workflow=await getWorkflow();
    sendJson(res,200,pageVideos(workflow,{
     q:url.searchParams.get('q')||'',state:url.searchParams.get('state')||'review',
     topic:url.searchParams.get('topic')||'',page:url.searchParams.get('page')||1,limit:20}));return;
   }
   if(req.method==='GET'&&route==='/api/plan'){
    const flow=await getWorkflow();
    sendJson(res,200,{blocked:flow.blocked,reason:flow.reason,writeEnabled:flow.phase2WriteEnabled,
      stats:flow.stats,milestones:flow.milestones,
      targetBreakdown:Object.entries(flow.stats.topics).map(([topic,count])=>({topic,target:TARGETS[topic],count}))});return;
   }
   if(req.method==='GET'&&route==='/api/export-plan'){
    const flow=await getWorkflow();
    // This is a local, non-executable plan. All rows are pending until fresh verification.
    const exportable=flow.videos.filter(v=>v.topic).map(v=>({
      bvid:v.bvid,title:v.title,targetTopic:v.topic,targetFolder:v.targetFolder,
      originFolders:v.sources.map(s=>s.folderName),status:v.syncState,approvedLocally:v.decision==='local_approved',
      platformAccessBlocked:flow.blocked,allowRemoteWrite:false}));
    sendJson(res,200,{
      generatedAt:flow.generatedAt,kind:'dry_run_only',accountWriteOperations:0,
      guard:{blocked:flow.blocked,reason:flow.reason},
      rules:['Do not auto-write','Reverify target memberships live','Respect all platform access restrictions'],
      entries:exportable
    },{'Content-Disposition':'attachment; filename="bilibili-sync-dry-run.json"'});return;
   }
   if(req.method==='POST'&&route==='/api/review'){
    if(!reviewAuth(req)){sendJson(res,403,{error:'csrf_or_origin_mismatch'});return;}
    try{const input=await loadSmallBody(req);sendJson(res,200,await saveReview(input));}
    catch(e){sendJson(res,400,{error:e.message});}return;
   }
   if(req.method==='GET'&&Object.hasOwn(assets,route)){
    try{const content=await readFile(join(root,'public',assets[route]));
      res.writeHead(200,{'Content-Type':mime[route]});res.end(content);}
    catch{res.writeHead(500);res.end('Static asset missing');}
    return;
   }
   if(req.method!=='GET'){res.writeHead(405);res.end('Method Not Allowed');return;}
   res.writeHead(404);res.end('Not Found');
  }catch(e){sendJson(res,500,{error:'internal_error'});console.error('Request failed:',e.message);}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createApp().listen(port,host,()=>console.log('Bilibili Favorites Workbench http://'+host+':'+port));
}
