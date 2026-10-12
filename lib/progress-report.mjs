import {createHash} from 'node:crypto';
import {readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildLocalCatalogFromDir} from './local-catalog.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function readOptional(path){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
export function reportFromCatalog(c,previous=null){
 const counts=c.totals;
 const current={memberships:counts.memberships,unique:counts.distinctBvids,
  proposed:counts.classifiedSuggestions,assisted:counts.assistedClassifications||0,approved:counts.locallyApproved,
  review:counts.needingReview,invalid:counts.invalid,unscanned:counts.unobservedFolders};
 const prev=previous?.current||null;
 const delta=Object.fromEntries(Object.entries(current).map(([k,v])=>[k,prev? v-(prev[k]||0):null]));
 return {version:1,generatedAt:new Date().toISOString(),
  fingerprint:hash([current,c.categories,c.unobserved]),
  current,delta,baselineAvailable:!!prev,
  account:{syncVerified:0,remoteRequestsThisRun:0,blocked:true},
  waitingOnExternalData:c.unobserved,
  outstanding:{localHumanReview:counts.needingReview,invalidDisposition:counts.invalid,
   remoteCollectionCountUnknown:true,remainingIncompleteFolders:counts.unobservedFolders},
  note:'本地分类建议不等于人工认可；没有读取的数据不能被算作已完成'};
}
export async function updateProgress(dataDir){
 const path=join(dataDir,'progress-latest.json');
 const previous=await readOptional(path);
 const catalog=await buildLocalCatalogFromDir(dataDir);
 const report=reportFromCatalog(catalog,previous);
 // Keep an append-only local history without writing private inventories to GitHub.
 if(!previous||report.fingerprint!==previous.fingerprint){
  await appendFile(join(dataDir,'progress-history.jsonl'),JSON.stringify(report)+'\n',{mode:0o600});
 }
 const temp=path+'.'+process.pid+'.tmp';
 await writeFile(temp,JSON.stringify(report,null,2),{mode:0o600});
 await rename(temp,path);
 return report;
}
