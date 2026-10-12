import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {titleSignals} from './evidence-candidates.mjs';
import {deriveWorkflow} from './workflow.mjs';

const readJson=async(p)=>{try{return JSON.parse(await readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const invalidMarker=s=>!s||['已失效视频','视频已失效','视频不存在','已删除视频','-'].includes(String(s).trim());
const markerText=t=>String(t||'').trim().replace(/https?:\/\/\S+/g,' ').replace(/[\s\u200b]+/g,' ').slice(0,400);
const meaningful=s=>markerText(s).length>=12&&!/^(?:原视频链接|关注主播|喜欢的记得|一键三连)/.test(markerText(s));
function select(v,rows){
 const primary=rows.find(r=>!invalidMarker(r.title));
 const title=primary?.title||v.title||'';
 const descriptions=[...new Set(rows.map(x=>x.intro).filter(meaningful))];
 const evidence=descriptions.join(' ');
 const titleMatch=titleSignals(title);
 const introMatch=titleSignals(evidence);
 const topics=Object.keys(titleMatch);
 const hints=Object.keys(introMatch);
 if(v.decision==='invalid'){
  if(!descriptions.length)return {topic:null,status:'invalid_no_usable_metadata',confidence:'none',basis:'暂无可用标题或有效简介'};
  // Lost title cannot be reconstructed from the description. Label as a
  // recoverable metadata hint, not verified restored title.
  if(hints.length===1)return {topic:hints[0],status:'invalid_intro_topic_hint',confidence:'low',basis:'仅由失效视频简介推测主题，原始标题仍不可恢复'};
  return {topic:null,status:'invalid_intro_needs_review',confidence:'unknown',basis:hints.length>1?'简介涉及多种主题':'简介未提供明确主题词'};
 }
 if(topics.length===1 && (!hints.length||hints.every(x=>x===topics[0])))
  return {topic:topics[0],status:'title_supported_suggestion',confidence:'medium',basis:'标题含特定主题词；无相反简介线索'};
 if(topics.length>1)
  return {topic:null,status:'multi_topic_review',confidence:'unknown',basis:'标题同时包含多个主题'};
 if(!topics.length && hints.length===1)
  return {topic:hints[0],status:'intro_supported_suggestion',confidence:'low',basis:'仅简介出现单一主题，需核实视频正文'};
 if(hints.length>1)return {topic:null,status:'multi_topic_review',confidence:'unknown',basis:'简介同时包含多个主题'};
 return {topic:null,status:'insufficient_metadata',confidence:'none',basis:'标题及简介不足以确定类别'};
}
export function reviewAll({inventory,workflow}){
 if(!inventory||!workflow)throw Error('missing_local_inventory');
 const byBvid=new Map();
 for(const row of inventory.members||[]){
  if(!byBvid.has(row.bvid))byBvid.set(row.bvid,[]);
  byBvid.get(row.bvid).push(row);
 }
 const rows=[],stats={total:0,remainingOriginal:0,invalidOriginal:0,reviewed:0,topicHints:0,unresolved:0,invalidWithUsableIntro:0,statuses:{}};
 for(const v of workflow.videos){
  if(!['unclassified','conflict','description_review','invalid'].includes(v.decision))continue;
  const originals=byBvid.get(v.bvid)||[];
  const result=select(v,originals);
  const entry={
   bvid:v.bvid,originalDecision:v.decision,originalTitle:v.title,
   topicHint:result.topic,status:result.status,confidence:result.confidence,
   basis:result.basis,requiresHumanConfirmation:true,
   videoWasViewed:false,accountWriteAllowed:false,
   originalDeleted:false,
   defaultPriority:v.sources.some(x=>x.folderName==='默认收藏夹'),
   descriptionAvailable:originals.some(x=>meaningful(x.intro))
  };
  rows.push(entry);stats.reviewed++;
  if(v.decision==='invalid'){stats.invalidOriginal++;if(entry.descriptionAvailable)stats.invalidWithUsableIntro++;}
  else stats.remainingOriginal++;
  if(entry.topicHint)stats.topicHints++;
  else stats.unresolved++;
  stats.statuses[entry.status]=(stats.statuses[entry.status]||0)+1;
 }
 rows.sort((a,b)=>Number(b.defaultPriority)-Number(a.defaultPriority)||a.bvid.localeCompare(b.bvid));
 stats.total=rows.length;
 return {version:1,createdAt:new Date().toISOString(),kind:'complete_offline_metadata_triage',
  stats,rows,networkRequests:0,accountWrites:0,manualApprovals:0,
  note:'逐条复核所有当前待分类及失效记录。没有可靠证据则保留未定，不推测恢复标题，不更改原始数据。'};
}
export async function reviewFromDir(dataDir){
 const [inventory,classification,description,overrides,assistant,guard,copySummary]=await Promise.all([
  'inventory-rescan-v2.json','v3-classification.json','description-review.json','manual-review-overrides.json',
  'local-ai-reviewed-decisions.json','account-access-guard.json','copy-summary.json'
 ].map(x=>readJson(join(dataDir,x))));
 const workflow=deriveWorkflow({inventory,classification,description,overrides,assistant,guard,copySummary});
 return reviewAll({inventory,workflow});
}
export async function saveDeepReview(dir,review){
 const p=join(dir,'complete-local-review.json'),tmp=p+'.tmp-'+process.pid;
 await writeFile(tmp,JSON.stringify(review,null,2),{mode:0o600});await rename(tmp,p);
 return p;
}
