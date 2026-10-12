import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {auditLocalData,saveAuditReport} from '../lib/offline-acceptance.mjs';
test('offline report keeps real remote completion blocked and preserves defaults',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-audit-'));
 try{
  const input={
   'inventory-rescan-v2.json':{complete:false,members:[{folder_id:1,folder_title:'默认收藏夹',bvid:'BV1234567890',title:'英语课'}],folders:[{title:'默认收藏夹',id:1}],folder_status:[{title:'默认收藏夹',reported:4599,retrieved:1,last_page:2,exhausted:false,last_error:'http_412'}]},
   'v3-classification.json':{summary:{categorized:1},categories:{英语:[{bvid:'BV1234567890'}]}},
   'account-access-guard.json':{status:'blocked',reason:'http_412'},
   'copy-summary.json':{copied:{英语:55,AI:70,编程:16,体育:7}}
  };
  for(const [name,val] of Object.entries(input))await writeFile(join(dir,name),JSON.stringify(val));
  const result=await auditLocalData(dir);
  assert.equal(result.finalVerdict,'NOT_DONE');
  assert.equal(result.account.accountRequestsPerformed,0);
  assert.equal(result.account.verifiedNewSync,0);
  assert.equal(result.account.historicalCopyResponses,148);
  assert.equal(result.defaultFolder.observed,1);
  assert.equal(result.defaultFolder.historicalReported,4599);
  assert.equal(result.defaultFolder.observedUniqueVideos,1);
  assert.equal(result.risks.find(x=>x.code==='bilibili_access_blocked').severity,'critical');
  await saveAuditReport(dir,result);
  assert.equal(JSON.parse(await readFile(join(dir,'offline-acceptance-report.json'),'utf8')).finalVerdict,'NOT_DONE');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing local data never reports completed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-empty-'));
 try{const result=await auditLocalData(dir);assert.equal(result.finalVerdict,'NOT_DONE');assert.equal(result.inventory.distinctBvids,0);}
 finally{await rm(dir,{recursive:true,force:true});}
});
