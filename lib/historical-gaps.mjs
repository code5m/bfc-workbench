import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {triageExpanded} from './expanded-triage.mjs';

const SOURCES=Object.freeze([
 'inventory.json','partial-members.json','inventory-rescan.json',
 'inventory-resume-state.json','rescan-checkpoint.json'
]);
const isBvid=s=>typeof s==='string'&&/^BV[0-9A-Za-z]{10}$/.test(s);
const invalidTitle=s=>!s||['已失效视频','视频已失效','视频不存在','已删除视频','-'].includes(String(s).trim());
async function readOptional(p){
 try{return JSON.parse(await readFile(p,'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
export function findHistoricalMembershipGaps({current,archives}={}){
 if(!Array.isArray(current?.members)||!Array.isArray(archives))
  throw Error('structured_snapshots_required');
 const known=new Set(current.members.map(r=>r.bvid).filter(isBvid));
 const map=new Map();
 for(const archive of archives){
  if(!SOURCES.includes(archive?.name)||!Array.isArray(archive?.data?.members))continue;
  for(const row of archive.data.members){
   const bvid=row?.bvid;
   if(!isBvid(bvid)||known.has(bvid))continue;
   let entry=map.get(bvid);
   if(!entry){
    entry={bvid,title:'已失效视频',intro:'',originalFolders:new Set(),sourceFiles:new Set()};
    map.set(bvid,entry);
   }
   const title=String(row.title||'').trim();
   if(!invalidTitle(title)&&title.length>0&&
      (invalidTitle(entry.title)||title.length>entry.title.length))entry.title=title.slice(0,240);
   const intro=String(row.intro||'').trim();
   if(intro!=='-'&&intro.length>entry.intro.length)entry.intro=intro.slice(0,600);
   if(row.folder_title)entry.originalFolders.add(String(row.folder_title).slice(0,100));
   entry.sourceFiles.add(archive.name);
  }
 }
 const rows=Array.from(map.values()).map(x=>{
  const topic=triageExpanded(
   {originalTitle:x.title,originalDecision:invalidTitle(x.title)?'invalid':'unclassified'},
   {description:x.intro}
  );
  return {
   bvid:x.bvid,title:x.title,originalFolders:[...x.originalFolders].sort(),
   sourceFiles:[...x.sourceFiles].sort(),
   hasUsableTitle:!invalidTitle(x.title),
   classificationHint:topic.topic||null,
   classificationConfidence:topic.confidence||'unknown',
   historicalMembershipOnly:true,currentMembershipVerified:false,
   safeToSync:false,accountReadbackRequired:true
  };
 }).sort((a,b)=>a.originalFolders.join(',').localeCompare(b.originalFolders.join(','),'zh-CN')||a.bvid.localeCompare(b.bvid));
 const folders={};
 for(const row of rows)
  for(const f of row.originalFolders)folders[f]=(folders[f]||0)+1;
 return {
  schemaVersion:1,generatedAt:new Date().toISOString(),
  kind:'historical_membership_gaps_not_current_account_state',
  totals:{
   currentUniqueBvids:known.size,archivedOnly:rows.length,
   titlesAvailable:rows.filter(x=>x.hasUsableTitle).length,
   titleUnavailable:rows.filter(x=>!x.hasUsableTitle).length,
   originallyDefaultFolder:rows.filter(x=>x.originalFolders.includes('默认收藏夹')).length,
   remoteRequests:0,accountWrites:0
  },
  folders,rows,
  warning:'历史快照中存在的收藏关系不等于当前仍收藏。必须回读确认，禁止将这些记录直接当成目标同步成功或当前库存。'
 };
}
export async function auditHistoricalGapsFromDir(dir){
 const current=await readOptional(join(dir,'inventory-rescan-v2.json'));
 const archives=await Promise.all(SOURCES.map(async name=>({name,data:await readOptional(join(dir,name))})));
 return findHistoricalMembershipGaps({current,archives});
}
export async function saveHistoricalGaps(dir,report){
 const path=join(dir,'historical-membership-gaps.json'),temp=path+'.'+process.pid+'.tmp';
 await writeFile(temp,JSON.stringify(report,null,2),{mode:0o600});
 await rename(temp,path);
 return path;
}
