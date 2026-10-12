import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {deriveWorkflow,TARGETS} from './workflow.mjs';

async function readJson(dir,name) {
 try{return JSON.parse(await readFile(join(dir,name),'utf8'))}
 catch(error){if(error.code==='ENOENT')return null;throw error}
}
export function buildLocalCatalog({inventory,classification,description,overrides,assistant,guard,copySummary}={}){
 const flow=deriveWorkflow({inventory,classification,description,overrides,assistant,guard,copySummary});
 const sources=new Map();
 const folders=(inventory?.folders||[]).map(f=>({
  id:f.id,name:f.title,reported:f.media_count||0,items:0,unique:new Set(),
  observedMembers:0
 }));
 const mapped=new Map(folders.map(f=>[String(f.id),f]));
 const records=flow.videos.map(v=>{
  for(const s of v.sources){
   const entry=mapped.get(String(s.folderId));
   if(entry){entry.items++;entry.unique.add(v.bvid)}
  }
  const state=v.decision==='local_approved'?'approved':
   v.decision==='suggested'?'proposed':v.decision==='assistant_reviewed'?'assisted':v.decision==='invalid'?'invalid':'review_required';
  return {...v,localReviewState:state,
   accountSyncState:'requires_live_readback',
   defaultSource:v.sources.some(s=>s.folderName==='默认收藏夹')};
 });
 const byBvid=new Set(records.map(x=>x.bvid));
 const membershipCount=inventory?.members?.length||0;
 const uniqueMemberships=new Set((inventory?.members||[]).map(x=>String(x.folder_id)+'/'+x.bvid)).size;
 const statusCounts={};
 for(const v of records)statusCounts[v.localReviewState]=(statusCounts[v.localReviewState]||0)+1;
 const themeCounts={};for(const v of records)if(v.topic)themeCounts[v.topic]=(themeCounts[v.topic]||0)+1;
 const unobserved=(inventory?.folder_status||[]).filter(f=>!f.exhausted).map(f=>({
  name:f.title,observed:f.retrieved,reported:f.reported,lastPage:f.last_page,reason:f.last_error||'not_finished'
 }));
 return {
  schemaVersion:1,generatedAt:new Date().toISOString(),localStatus:'READY_WITH_EXCEPTIONS',
  remoteWriteAllowed:false,remoteWriteCount:0,liveReadbackVerified:0,
  totals:{memberships:membershipCount,distinctBvids:byBvid.size,
   uniqueMemberships,duplicateRows:membershipCount-uniqueMemberships,
   classifiedSuggestions:statusCounts.proposed||0,
   assistedClassifications:statusCounts.assisted||0,
   locallyApproved:statusCounts.approved||0,
   needingReview:statusCounts.review_required||0,
   invalid:statusCounts.invalid||0,
   unobservedFolders:unobserved.length,
   observedOnly:true},
  categories:Object.entries(themeCounts).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({
   name,count,targetFolder:TARGETS[name]
  })),
  folders:folders.map(({unique,...f})=>({...f,distinctBvids:unique.size})),
  unobserved,records
 };
}
export async function buildLocalCatalogFromDir(dir){
 const [inventory,classification,description,overrides,guard,copySummary,assistant]=await Promise.all([
  'inventory-rescan-v2.json','v3-classification.json','description-review.json',
  'manual-review-overrides.json','account-access-guard.json','copy-summary.json','local-ai-reviewed-decisions.json'
 ].map(x=>readJson(dir,x)));
 return buildLocalCatalog({inventory,classification,description,overrides,assistant,guard,copySummary});
}
export async function saveLocalCatalog(dir,catalog){
 const path=join(dir,'local-organized-catalog.json');
 const tmp=path+'.'+process.pid+'.tmp';
 await writeFile(tmp,JSON.stringify(catalog,null,2),{mode:0o600});
 await rename(tmp,path);
 return path;
}
