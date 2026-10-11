import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCompletion} from '../lib/completion.mjs';

const sample=()=>({
 inventory:{complete:false,folder_status:[
  {title:'默认收藏夹',reported:4599,retrieved:1678,last_page:86,last_error:'http_412',exhausted:false},
  {title:'编程',reported:100,retrieved:100,last_page:5,exhausted:true},
 ]},
 workflow:{blocked:true,stats:{
  memberships:2134,unique:1991,classified:1003,manual:0,conflict:23,unclassified:715,
  descriptionReview:150,invalid:100,needsTargetCreate:121,historicalCopied:148,phase2Verified:0
 }},
 guard:{status:'blocked',reason:'http_412'},
});
test('real account still not finished despite local classifications',()=>{
 const d=assessCompletion(sample());
 assert.equal(d.allDone,false);assert.equal(d.overallStatus,'NOT_DONE');
 assert.equal(d.passed,0);assert.equal(d.total,8);
 assert.equal(d.defaultFolder.historicalReported,4599);
 assert.equal(d.defaultFolder.observed,1678);
 assert.equal(d.defaultFolder.notObservedEstimate,2921);
 assert.equal(d.defaultFolder.cleared,false);
 assert.equal(d.basis.secondRoundVerified,0);
 assert.equal(d.gates.find(x=>x.id==='G6').status,'blocked');
});
test('forged success without authorized readback proof never passes',()=>{
 const d=assessCompletion({
  ...sample(),
  inventory:{complete:true,folder_status:[{title:'默认收藏夹',exhausted:true,reported:0,retrieved:0}]},
  guard:null,workflow:{blocked:false,stats:{
   unique:2,classified:2,manual:0,conflict:0,unclassified:0,descriptionReview:0,invalid:0,needsTargetCreate:0
  }},
  finalEvidence:{defaultFolder:{remainingActionable:0,fullyScanned:true,exceptionsDocumented:true},
   sync:{pendingUnverified:0},proofs:{sync:{result:'pass',source:'local_dry_run',evidenceRef:'fake',recordedAt:new Date().toISOString()}}}
 });
 assert.equal(d.allDone,false);
 assert.equal(d.gates.find(x=>x.id==='G5').status,'pending');
 assert.equal(d.gates.find(x=>x.id==='G6').status,'pending');
});
test('empty snapshot cannot be considered complete',()=>{
 const d=assessCompletion({});
 assert.equal(d.allDone,false);assert.equal(d.defaultFolder.exists,false);
 assert.equal(d.gates.length,8);
});
