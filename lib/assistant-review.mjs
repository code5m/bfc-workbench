import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validTopic} from './workflow.mjs';

const digest=s=>createHash('sha256').update(String(s)).digest('hex');
const load=async path=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e}};
const CURRENT_VERSION=1;
const choicesFile='local-semantic-review-choices.json';
const evidenceFile='local-evidence-proposals.json';
const resultFile='local-ai-reviewed-decisions.json';
export const semanticFiles=Object.freeze({choicesFile,evidenceFile,resultFile});
export function adjudicateEvidence({workflow,evidence,choices}){
 if(!Array.isArray(workflow?.videos) || !Array.isArray(evidence?.proposals))
  throw new Error('workflow_or_evidence_missing');
 if(choices?.version!==CURRENT_VERSION || typeof choices.decisions!=='object' ||
    !choices.decisions || Array.isArray(choices.decisions))
  throw new Error('invalid_semantic_choices');
 const videoById=new Map(workflow.videos.map(v=>[v.bvid,v]));
 const evidenceById=new Map(evidence.proposals.map(v=>[v.bvid,v]));
 const decisions=Object.create(null);
 const seenIds=new Set();
 const byGroup=Object.create(null);
 for(const [bvid,choice] of Object.entries(choices.decisions)){
  if(seenIds.has(bvid) || !/^BV[0-9A-Za-z]{8,20}$/.test(bvid))
    throw new Error('invalid_or_duplicate_bvid');
  seenIds.add(bvid);
  const video=videoById.get(bvid),proposal=evidenceById.get(bvid);
  if(!video||!proposal)throw new Error('choice_missing_from_original_review_pool');
  if(!['conflict','unclassified','description_review'].includes(video.decision))
    throw new Error('original_review_state_mismatch');
  if(!validTopic(choice?.topic))throw new Error('unknown_topic');
  if(choice?.title !== video.title)throw new Error('stale_or_changed_video_title');
  if(typeof choice.reason!=='string' || choice.reason.length<4 || choice.reason.length>220)
    throw new Error('review_reason_required');
  // Content is not watched, and evidence is not an account sync success.
  // Do not convert assistant opinion into human approval.
  const record={
   topic:choice.topic,title:video.title,
   rationale:choice.reason,
   originalDecision:video.decision,
   evidenceStatus:proposal.status,
   originalTitleTopic:proposal.topic||null,
   origin:'assistant_local_metadata_review',
   confidence:'metadata_supported_not_content_verified',
   humanApproved:false,requiresHumanConfirmation:true,
   accountWriteAllowed:false,
   titleFingerprint:digest(video.title)
  };
  decisions[bvid]=record;
  byGroup[proposal.status]=(byGroup[proposal.status]||0)+1;
 }
 const sourceGroups={};
 for(const proposal of evidence.proposals)sourceGroups[proposal.status]=(sourceGroups[proposal.status]||0)+1;
 const unresolved=evidence.proposals.filter(v=>!decisions[v.bvid]);
 return {
  version:CURRENT_VERSION,generatedAt:new Date().toISOString(),
  inventoryFingerprint:evidence.inputFingerprint,
  source:'assistant_local_metadata_review',
  humanApprovedCount:0,accountWrites:0,remoteRequests:0,
  decisions,
  summary:{
    originalReview:evidence.proposals.length,
    reviewedByAssistant:Object.keys(decisions).length,
    remainingUnresolved:unresolved.length,
    reviewedByEvidenceGroup:byGroup,
    originalEvidenceGroups:sourceGroups,
    originalTitleSuggestions:evidence.summary.titleSpecific,
    defaultSourceReviewed:unresolved.length===0?evidence.proposals.filter(x=>x.defaultSource).length:
      evidence.proposals.filter(x=>x.defaultSource && decisions[x.bvid]).length,
    humanApproved:0,videoContentWatched:0
  },
  unresolvedSummary:unresolved.reduce((acc,v)=>{acc[v.status]=(acc[v.status]||0)+1;return acc;},{}),
  note:'视频标题及简介的辅助判定，不代表视频内容已观看、用户人工确认或 B站账号同步。'
 };
}
export async function prepareLocalSemanticReview(dataDir,workflow){
 const [choices,evidence]=await Promise.all([
  load(join(dataDir,choicesFile)),load(join(dataDir,evidenceFile))
 ]);
 const result=adjudicateEvidence({workflow,evidence,choices});
 const destination=join(dataDir,resultFile);
 const old=await load(destination);
 const serial=JSON.stringify(result.decisions);
 if(old && JSON.stringify(old.decisions)===serial &&
  old.inventoryFingerprint===result.inventoryFingerprint)return old;
 if(old){
  const backup=join(dataDir,'local-ai-reviewed-backup-'+Date.now()+'-'+randomUUID()+'.json');
  await writeFile(backup,JSON.stringify(old,null,2),{mode:0o600,flag:'wx'});
 }
 const tmp=destination+'.'+process.pid+'-'+randomUUID()+'.tmp';
 try{
  await writeFile(tmp,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
  await rename(tmp,destination);
 }finally{
  const {unlink}=await import('node:fs/promises');
  await unlink(tmp).catch(()=>{});
 }
 await appendFile(join(dataDir,'local-ai-review-audit.jsonl'),
  JSON.stringify({at:new Date().toISOString(),action:'assist_metadata_classification',
  selected:result.summary.reviewedByAssistant,originalReview:result.summary.originalReview,
  humanApproved:0,remoteRequests:0})+'\n',{mode:0o600});
 return result;
}
export async function loadLocalSemanticReview(dataDir){
 return load(join(dataDir,resultFile));
}
