import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWorkflow,pageVideos} from '../lib/workflow.mjs';
import {createApp,summarize} from '../server.mjs';

const fixture=()=>({
 inventory:{members:[
  {bvid:'BV1234567890',title:'编程和AI示例',folder_id:1,folder_title:'默认收藏夹'},
  {bvid:'BV1234567890',title:'编程和AI示例',folder_id:2,folder_title:'编程'},
  {bvid:'BV1234567891',title:'英语练习',folder_id:1,folder_title:'默认收藏夹'},
  {bvid:'BV1234567892',title:'已失效视频',folder_id:1,folder_title:'默认收藏夹'},
  {bvid:'BV1234567893',title:'一个新视频',folder_id:1,folder_title:'默认收藏夹'}
 ],complete:false,folders:[{title:'默认收藏夹'},{title:'编程'},{title:'英语'}],
 folder_status:[{title:'默认收藏夹',retrieved:4,exhausted:false},{title:'编程',retrieved:1,exhausted:true},{title:'英语',retrieved:1,exhausted:true}]},
 classification:{categories:{'AI':[{bvid:'BV1234567890'}],'编程':[{bvid:'BV1234567890'}],'英语':[{bvid:'BV1234567891'}]}},
 description:{decisions:[{bvid:'BV1234567893',status:'review_suggested',candidate:'电影创作'}]},
 guard:{status:'blocked',reason:'http_412'},copySummary:{copied:{英语:55,AI:70,编程:16,体育:7}}
});
test('unique BV deduplication, ambiguous classification and guard',()=>{
 const w=deriveWorkflow(fixture());
 assert.equal(w.stats.memberships,5);
 assert.equal(w.stats.unique,4);
 assert.equal(w.stats.conflict,1);
 assert.equal(w.stats.descriptionReview,1);
 assert.equal(w.stats.invalid,1);
 assert.equal(w.stats.historicalCopied,148);
 assert.equal(w.stats.phase2Verified,0);
 assert.equal(w.phase2WriteEnabled,false);
 assert.equal(w.blocked,true);
 assert.equal(pageVideos(w,{state:'review'}).count,2);
});
test('local approval of a conflict does not permit account writing',()=>{
 const f=fixture();
 f.overrides={version:1,decisions:{BV1234567890:{topic:'编程'}}};
 const w=deriveWorkflow(f);
 assert.equal(w.stats.conflict,0);
 assert.equal(w.stats.manual,1);
 assert.equal(w.videos.find(v=>v.bvid==='BV1234567890').syncState,'exists_in_target_snapshot');
 assert.equal(w.phase2WriteEnabled,false);
});
test('pagination, search and category filtering',()=>{
 const w=deriveWorkflow(fixture());
 assert.equal(pageVideos(w,{state:'review',limit:1,page:2}).items.length,1);
 assert.equal(pageVideos(w,{state:'all',q:'英语'}).count,1);
 assert.equal(pageVideos(w,{state:'review',topic:'电影创作'}).count,1);
});
test('HTTP enforces GET boundaries and invalid paths remain unavailable',async()=>{
 const app=createApp();await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+app.address().port;
 try{
  const res=await fetch(origin+'/api/status');assert.equal(res.status,200);
  assert.equal((await res.json()).accountMutationsEnabled,false);
  const bad=await fetch(origin+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bvid:'BV1234567891',topic:'英语'})});
  assert.equal(bad.status,403);
  const raw=await fetch(origin+'/inventory-rescan-v2.json');assert.equal(raw.status,404);
  const plan=await fetch(origin+'/api/plan');assert.equal((await plan.json()).writeEnabled,false);
 }finally{await new Promise(resolve=>app.close(resolve));}
});
