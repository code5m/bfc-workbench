import {readFile,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {triageExpanded} from '../lib/expanded-triage.mjs';

const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const input=JSON.parse(await readFile(join(dir,'browser-live-snapshot.json'),'utf8'));
const records=input.members.map(item=>({bvid:item.bvid,title:item.title,sourcePage:item.source_page,...triageExpanded({originalDecision:item.title==='已失效视频'?'invalid':'observed'}, {title:item.title})}));
const byTopic={};
for(const row of records)if(row.topic)byTopic[row.topic]=(byTopic[row.topic]||0)+1;
const output={version:1,source:'authorized_browser_readback',generated_at:new Date().toISOString(),input:{reportedTotal:input.reported_total,observedMembers:input.observed_memberships,shortfall:input.shortfall},summary:{observed:records.length,provisionalTopics:Object.values(byTopic).reduce((a,b)=>a+b,0),needsReview:records.filter(x=>!x.topic).length,invalid:records.filter(x=>x.status==='invalid_description_hint').length,byTopic},records,accountWrites:0,requiresHumanApproval:true,complete:false};
const path=join(dir,'browser-live-classification.json');
const tmp=path+'.'+process.pid+'.tmp';
await writeFile(tmp,JSON.stringify(output,null,2),{mode:0o600});
await rename(tmp,path);
console.log(JSON.stringify({path,summary:output.summary},null,2));
