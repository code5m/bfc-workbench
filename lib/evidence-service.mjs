import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {deriveWorkflow} from './workflow.mjs';
import {buildEvidenceCandidates,saveEvidence,loadEvidence} from './evidence-candidates.mjs';
const read=async(p)=>{try{return JSON.parse(await readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
export async function prepareEvidence(dataDir){
 const [inventory,classification,description,overrides,guard,copySummary]=await Promise.all([
 'inventory-rescan-v2.json','v3-classification.json','description-review.json',
 'manual-review-overrides.json','account-access-guard.json','copy-summary.json'
 ].map(x=>read(join(dataDir,x))));
 const workflow=deriveWorkflow({inventory,classification,description,overrides,guard,copySummary});
 const result=buildEvidenceCandidates({inventory,workflow});
 await saveEvidence(dataDir,result);
 return result;
}
export async function currentEvidence(dataDir){
 const inventory=await read(join(dataDir,'inventory-rescan-v2.json'));
 if(!inventory)return null;
 return loadEvidence(dataDir,inventory);
}
