import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceCandidates,titleSignals} from '../lib/evidence-candidates.mjs';
test('specific coding title receives a proposal but never an approval',()=>{
 const inventory={members:[{folder_id:1,bvid:'BV1234567890',title:'GitHub仓库管理教程',intro:''}]};
 const workflow={stats:{unique:1},videos:[{bvid:'BV1234567890',title:'GitHub仓库管理教程',sources:[{folderName:'默认收藏夹'}],decision:'unclassified',candidateTopics:[]}]};
 const out=buildEvidenceCandidates({inventory,workflow});
 assert.equal(out.summary.titleSpecific,1);
 assert.equal(out.summary.titleEvidenceDefault,1);
 assert.equal(out.proposals[0].topic,'编程');
 assert.equal(out.proposals[0].requiresHumanApproval,true);
 assert.equal(out.proposals[0].accountWriteAllowed,false);
 assert.equal(out.accountRequests,0);
});
test('cross-topic title and old conflicts are not force-classified',()=>{
 const inventory={members:[{folder_id:1,bvid:'BV1234567890',title:'Claude写Python项目实战',intro:''},{folder_id:1,bvid:'BV1234567891',title:'GitHub仓库管理',intro:''}]};
 const workflow={stats:{unique:2},videos:[
 {bvid:'BV1234567890',title:'Claude写Python项目实战',sources:[],decision:'unclassified',candidateTopics:[]},
 {bvid:'BV1234567891',title:'GitHub仓库管理',sources:[],decision:'conflict',candidateTopics:['AI','编程']}
 ]};
 const out=buildEvidenceCandidates({inventory,workflow});
 assert.equal(out.summary.titleSpecific,0);
 assert.equal(out.summary.needsHumanReview,2);
 assert.equal(out.proposals.every(x=>x.topic===null),true);
});
test('no review rows means no generated proposals',()=>{
 const out=buildEvidenceCandidates({inventory:{members:[]},workflow:{stats:{unique:0},videos:[]}});
 assert.equal(out.proposals.length,0);
 assert.equal(Object.keys(titleSignals('随便看看')).length,0);
});
