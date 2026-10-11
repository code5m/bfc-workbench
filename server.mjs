import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.BILIBILI_FAVORITES_DATA_DIR || join(homedir(),'Documents','Bilibili-Favorites-Review');
const host='127.0.0.1', port=Number(process.env.PORT || 4198);
const readJson=async(name)=>{try{return JSON.parse(await readFile(join(dataDir,name),'utf8'));}catch{return null;}};
export function summarize({inventory,classification,guard,copy,desc}) {
 const records=inventory?.members || [];
 const folders=inventory?.folder_status || [];
 const topics=classification?.summary?.categories || {};
 const completed=copy?.copied || {};
 const blocked=guard?.status==='blocked';
 const blockedReason=blocked ? String(guard?.reason || 'unavailable') : null;
 const classified=Object.values(topics).reduce((sum,n)=>sum+Number(n||0),0);
 return {
  updatedAt:new Date().toISOString(),
  status:blocked ? 'platform_access_blocked' : 'local_readonly',
  accountMutationsEnabled:false,
  snapshot:{memberships:records.length,distinctBvids:new Set(records.map(x=>x.bvid).filter(Boolean)).size,complete:inventory?.complete===true},
  classification:{categorized:classified,review:classification?.summary?.review || 0,invalid:classification?.summary?.invalid || 0,byTopic:topics,descriptionSuggestions:desc?.summary?.additional_review_suggestions || 0},
  sync:{historicalCopies:Object.values(completed).reduce((sum,n)=>sum+Number(n||0),0),phase2Verified:0,note:'历史成功写入与本地分类建议不等于第二轮同步完成'},
  access:{blocked,reason:blockedReason,requireReview:blocked},
  folders:folders.map(x=>({name:String(x.title || ''),read:Number(x.retrieved||0),reported:Number(x.reported||0),nextPage:Number(x.last_page||1),complete:x.exhausted===true,lastError:x.last_error || null})),
  actionQueue:[
   {title:'本地分类与复核',status:classified>0?'working':'pending',detail:'可离线继续，不需要请求 B站'},
   {title:'平台正常授权访问确认',status:blocked?'blocked':'pending',detail:blocked?'HTTP 412 账号级暂停保护生效':'需正常授权并通过真实回读验收'},
   {title:'完整读取全部可见收藏',status:inventory?.complete?'done':'pending',detail:'继续记录未完成目录和断点'},
   {title:'第二轮账号同步',status:'pending',detail:'必须具备获授权的写入工具及回读验收'}
  ]
 };
}
export async function snapshot(){
 const [inventory,classification,guard,copy,desc]=await Promise.all([
  readJson('inventory-rescan-v2.json'),readJson('v3-classification.json'),
  readJson('account-access-guard.json'),readJson('copy-summary.json'),
  readJson('description-review.json')
 ]);
 return summarize({inventory,classification,guard,copy,desc});
}
const mime={'/':'text/html; charset=utf-8','/app.js':'application/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'};
const assets={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
export function createApp(){
 return createServer(async(req,res)=>{
  const url=(req.url||'/').split('?')[0];
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if(req.method!=='GET'){res.writeHead(405);res.end('Method Not Allowed');return;}
  if(url==='/api/status'){
   const data=await snapshot();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));return;
  }
  if(assets[url]){
   try{const content=await readFile(join(root,'public',assets[url]));res.writeHead(200,{'Content-Type':mime[url]});res.end(content);}
   catch{res.writeHead(500);res.end('Static asset missing');}
   return;
  }
  res.writeHead(404);res.end('Not Found');
 });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 createApp().listen(port,host,()=>console.log('Bilibili Favorites Workbench http://'+host+':'+port));
}
