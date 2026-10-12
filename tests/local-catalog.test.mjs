import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocalCatalog} from '../lib/local-catalog.mjs';
test('build local catalog without losing duplicate-source provenance',()=>{
 const catalog=buildLocalCatalog({
  inventory:{members:[
   {folder_id:1,folder_title:'默认收藏夹',bvid:'BV1234567890',title:'Python课程'},
   {folder_id:2,folder_title:'编程',bvid:'BV1234567890',title:'Python课程'},
   {folder_id:1,folder_title:'默认收藏夹',bvid:'BV1234567891',title:'已失效视频'},
  ],folders:[{id:1,title:'默认收藏夹',media_count:4599},{id:2,title:'编程',media_count:100}],
  folder_status:[{title:'默认收藏夹',exhausted:false,retrieved:2,reported:4599,last_page:2,last_error:'http_412'},{title:'编程',exhausted:true,retrieved:1,reported:100}]},
  classification:{categories:{编程:[{bvid:'BV1234567890'}]}},guard:{status:'blocked',reason:'http_412'}
 });
 assert.equal(catalog.totals.memberships,3);
 assert.equal(catalog.totals.distinctBvids,2);
 assert.equal(catalog.totals.duplicateRows,0);
 assert.equal(catalog.totals.invalid,1);
 assert.equal(catalog.totals.unobservedFolders,1);
 assert.equal(catalog.records.find(x=>x.bvid==='BV1234567890').sources.length,2);
 assert.equal(catalog.remoteWriteCount,0);
});
