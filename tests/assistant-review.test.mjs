import test from 'node:test';
import assert from 'node:assert/strict';
import {adjudicateEvidence} from '../lib/assistant-review.mjs';
import {deriveWorkflow} from '../lib/workflow.mjs';
const bvid='BV1234567890',title='Rust程序开发原理';
const inventory={members:[{bvid,title,folder_id:1,folder_title:'默认收藏夹'}],folders:[{title:'默认收藏夹'}],folder_status:[{title:'默认收藏夹',exhausted:false}]};
const workflow=deriveWorkflow({inventory,guard:{status:'blocked',reason:'http_412'}});
const evidence={proposals:[{bvid,status:'title_specific_proposal',topic:'编程',defaultSource:true}],inputFingerprint:'abc',summary:{titleSpecific:1}};
test('assistant reviews remain distinct from user approvals and remote writes',()=>{
 const reviewed=adjudicateEvidence({workflow,evidence,choices:{version:1,decisions:{[bvid]:{topic:'编程',title,reason:'本地标题明确描述 Rust 程序开发'}}}});
 assert.equal(reviewed.summary.reviewedByAssistant,1);
 assert.equal(reviewed.summary.humanApproved,0);
 assert.equal(reviewed.accountWrites,0);
 const next=deriveWorkflow({inventory,assistant:reviewed,guard:{status:'blocked',reason:'http_412'}});
 assert.equal(next.stats.assistantReviewed,1);assert.equal(next.stats.manual,0);
 assert.equal(next.stats.unclassified,0);assert.equal(next.phase2WriteEnabled,false);
});
test('assistant stale title and invalid topics fail closed',()=>{
 assert.throws(()=>adjudicateEvidence({workflow,evidence,choices:{version:1,decisions:{[bvid]:{topic:'编程',title:'被替换',reason:'标题不一致'}}}}),/stale/);
 assert.throws(()=>adjudicateEvidence({workflow,evidence,choices:{version:1,decisions:{[bvid]:{topic:'不存在',title,reason:'无效分类'}}}}),/unknown_topic/);
});
