import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {deriveWorkflow} from './workflow.mjs';
import {assessCompletion} from './completion.mjs';
import {auditStrategy} from './strategy-audit.mjs';
const json=async(path)=>{try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function auditLocalData(dataDir){
 const [inventory,classification,description,overrides,guard,copy,evidence]=await Promise.all([
  'inventory-rescan-v2.json','v3-classification.json','description-review.json',
  'manual-review-overrides.json','account-access-guard.json','copy-summary.json',
  'final-acceptance-evidence.json'].map(f=>json(join(dataDir,f))));
 const workflow=deriveWorkflow({inventory,classification,description,overrides,guard,copySummary:copy});
 const completion=assessCompletion({inventory,workflow,guard,finalEvidence:evidence});
 const strategy=auditStrategy({inventory,guard,classification});
 const defaultItems=workflow.videos.filter(v=>v.sources.some(s=>s.folderName==='默认收藏夹'));
 const breakdown={};
 for(const item of defaultItems)breakdown[item.decision]=(breakdown[item.decision]||0)+1;
 const unresolved=workflow.videos.filter(v=>['conflict','unclassified','description_review'].includes(v.decision));
 const risks=[];
 if(!inventory)risks.push({severity:'critical',code:'inventory_missing'});
 if(!classification)risks.push({severity:'high',code:'classification_missing'});
 if(guard?.status==='blocked')risks.push({severity:'critical',code:'bilibili_access_blocked',detail:guard.reason||'unknown'});
 if(!workflow.stats.scanComplete)risks.push({severity:'critical',code:'incomplete_favorites_scan',unfinished:strategy.unfinishedFolders.length});
 if(unresolved.length)risks.push({severity:'high',code:'videos_needing_review',count:unresolved.length});
 if(strategy.duplicateMemberships.length)risks.push({severity:'medium',code:'repeated_folder_memberships',count:strategy.duplicateMemberships.length});
 if(workflow.stats.needsTargetCreate)risks.push({severity:'high',code:'target_folder_missing',count:workflow.stats.needsTargetCreate});
 const result={
  schemaVersion:1,kind:'offline_acceptance_audit',generatedAt:new Date().toISOString(),
  sourceFingerprint:digest({
    folders:inventory?.folder_status||[],members:(inventory?.members||[]).map(x=>[x.folder_id,x.bvid]),
    classification:classification?.summary||{},guard,overrides
  }),
  completion:{allDone:completion.allDone,overallStatus:completion.overallStatus,passed:completion.passed,total:completion.total,gates:completion.gates},
  defaultFolder:{...completion.defaultFolder,observedUniqueVideos:defaultItems.length,localDecisions:breakdown},
  inventory:{observedMemberships:workflow.stats.memberships,distinctBvids:workflow.stats.unique,completedFolders:workflow.stats.completeFolders,folderCount:workflow.stats.totalFolders,missingFolders:strategy.unfinishedFolders},
  review:{needsReview:unresolved.length,invalid:workflow.stats.invalid,classified:workflow.stats.classified,manual:workflow.stats.manual},
  account:{blocked:guard?.status==='blocked',historicalCopyResponses:workflow.stats.historicalCopied,verifiedNewSync:0,verifiedRemovedFromDefault:null,accountRequestsPerformed:0,accountWritesPerformed:0},
  risks,finalVerdict:completion.allDone?'ALL_DONE':'NOT_DONE',
  note:'离线审计和分类不等于账号同步；必须凭真实回读证据过 G1-G8。'
 };
 return result;
}
export async function saveAuditReport(dataDir,report){
 await mkdir(dataDir,{recursive:true});
 const path=join(dataDir,'offline-acceptance-report.json');
 const tmp=path+'.'+process.pid+'.tmp';
 await writeFile(tmp,JSON.stringify(report,null,2),{mode:0o600});
 await rename(tmp,path);
 return path;
}
