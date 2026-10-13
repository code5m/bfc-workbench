import test from 'node:test';
import assert from 'node:assert/strict';
import {findHistoricalMembershipGaps} from '../lib/historical-gaps.mjs';

test('historical only records retain original folder provenance without syncing',()=>{
 const current={members:[{bvid:'BV1234567890'}]};
 const archives=[
  {name:'inventory.json',data:{members:[
   {bvid:'BV1234567890',title:'Current'},
   {bvid:'BV1234567891',title:'Blender镜头教程',folder_title:'视频剪辑等'},
   {bvid:'BV1234567892',title:'已失效视频',folder_title:'生活',intro:'-'}
  ]}},
  {name:'partial-members.json',data:{members:[
   {bvid:'BV1234567891',title:'Blender镜头教程',folder_title:'视频剪辑等'},
   {bvid:'BV1234567891',title:'Blender镜头教程',folder_title:'默认收藏夹'},
   {bvid:'invalid',title:'No'}
  ]}}
 ];
 const result=findHistoricalMembershipGaps({current,archives});
 assert.equal(result.totals.currentUniqueBvids,1);
 assert.equal(result.totals.archivedOnly,2);
 assert.equal(result.totals.titlesAvailable,1);
 assert.equal(result.totals.titleUnavailable,1);
 assert.equal(result.totals.originallyDefaultFolder,1);
 assert.equal(result.totals.remoteRequests,0);
 assert.equal(result.totals.accountWrites,0);
 const row=result.rows.find(x=>x.bvid==='BV1234567891');
 assert.deepEqual(row.sourceFiles,['inventory.json','partial-members.json']);
 assert.deepEqual(row.originalFolders,['视频剪辑等','默认收藏夹'].sort());
 assert.equal(row.currentMembershipVerified,false);
 assert.equal(row.safeToSync,false);
});

test('text mentions alone are never treated as real archived membership',()=>{
 const result=findHistoricalMembershipGaps({
  current:{members:[]},
  archives:[{name:'inventory.json',data:{members:[{
   bvid:'BV1234567890',title:'谈谈 BV1234567892 的视频',folder_title:'英语'
  }]}}]
 });
 assert.equal(result.totals.archivedOnly,1);
 assert.equal(result.rows.some(x=>x.bvid==='BV1234567892'),false);
});
