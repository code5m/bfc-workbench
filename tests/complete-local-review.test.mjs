import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewAll} from '../lib/complete-local-review.mjs';
test('all outstanding and invalid records included exactly once',()=>{
 const inventory={members:[
  {bvid:'BV1234567890',folder_id:1,title:'已失效视频',intro:'Python 代码架构教学'},
  {bvid:'BV1234567891',folder_id:1,title:'完全没有线索',intro:''},
  {bvid:'BV1234567892',folder_id:1,title:'AI和电影制作',intro:''}
 ]};
 const workflow={videos:[
  {bvid:'BV1234567890',title:'已失效视频',decision:'invalid',sources:[]},
  {bvid:'BV1234567891',title:'完全没有线索',decision:'unclassified',sources:[]},
  {bvid:'BV1234567892',title:'AI和电影制作',decision:'conflict',sources:[]}
 ]};
 const r=reviewAll({inventory,workflow});
 assert.equal(r.stats.reviewed,3);assert.equal(r.stats.invalidOriginal,1);
 assert.equal(r.rows[0].accountWriteAllowed,false);
 assert.equal(r.rows.find(x=>x.bvid==='BV1234567890').status,'invalid_intro_topic_hint');
 assert.equal(r.rows.find(x=>x.bvid==='BV1234567890').originalTitle,'已失效视频');
 assert.equal(r.rows.find(x=>x.bvid==='BV1234567891').topicHint,null);
});
