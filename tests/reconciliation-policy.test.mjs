import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWorkbenchSnapshot} from '../lib/workbench-diff.mjs';
test('accepted 67 offset is normal after traversal and deviations stay visible',()=>{
 const capture={reportedTotal:68,expectedPages:1,traversalFinished:true,pages:{1:{items:[{bvid:'a'}]}}};
 assert.equal(compareWorkbenchSnapshot({videos:{}},capture).gapStatus,'normal');
 assert.equal(compareWorkbenchSnapshot({videos:{}},{...capture,reportedTotal:69}).gapDeviation,1);
 assert.equal(compareWorkbenchSnapshot({videos:{}},{...capture,reportedTotal:69}).gapStatus,'deviation');
 assert.equal(compareWorkbenchSnapshot({videos:{}},{...capture,traversalFinished:false}).gapStatus,'pending_scan');
 assert.equal(compareWorkbenchSnapshot({videos:{}},{...capture,folderId:'other'}).gapStatus,'deviation');
});
