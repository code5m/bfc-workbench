import {readFile,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {triageExpanded} from '../lib/expanded-triage.mjs';
const dataDir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const prior=JSON.parse(await readFile(join(dataDir,'complete-local-review.json'),'utf8'));
const inventory=JSON.parse(await readFile(join(dataDir,'inventory-rescan-v2.json'),'utf8'));
const descriptions=new Map();
for(const row of inventory.members){
  if(!descriptions.has(row.bvid))descriptions.set(row.bvid,[]);
  if(row.intro)descriptions.get(row.bvid).push(row.intro);
}
const records=prior.rows.filter(row=>!row.topicHint).map(row=>{
 const descriptionsFound=descriptions.get(row.bvid)||[];
 const description=descriptionsFound.sort((a,b)=>b.length-a.length)[0]||'';
 return {...row,expanded:triageExpanded(row,{description})};
});
const stats={reviewed:records.length,provisionalTitleHints:0,invalidDescriptionHints:0,unresolved:0};
for(const row of records){
 if(row.expanded.status==='expanded_title_hint')stats.provisionalTitleHints++;
 else if(row.expanded.status==='invalid_description_hint')stats.invalidDescriptionHints++;
 else stats.unresolved++;
}
if(records.length!==prior.stats.unresolved||stats.unresolved+stats.provisionalTitleHints+stats.invalidDescriptionHints!==records.length)
 throw Error('local_reconciliation_failed');
const report={version:1,generatedAt:new Date().toISOString(),source:'offline_expanded_metadata_review',status:'PROVISIONAL_NOT_APPROVED',
 stats,records,accountRequests:0,accountWrites:0,humanApprovals:0,
 note:'扩展主题仅是待核实建议。对已失效视频，只从留存简介提取低置信度主题；绝不虚构原始标题。'};
const path=join(dataDir,'expanded-local-triage.json'),tmp=path+'.'+process.pid+'.tmp';
await writeFile(tmp,JSON.stringify(report,null,2),{mode:0o600});await rename(tmp,path);
console.log(JSON.stringify({path,stats},null,2));
