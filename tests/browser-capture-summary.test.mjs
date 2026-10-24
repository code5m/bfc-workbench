import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBrowserCapture} from '../server.mjs';

test('dashboard uses the same evidence and completeness rules as reconciliation',()=>{
 const absent=summarizeBrowserCapture({pages:{}});
 assert.equal(absent.reportedTotal,null);assert.equal(absent.shortfall,null);assert.equal(absent.complete,false);
 const current=summarizeBrowserCapture({reportedTotal:4748,capturedAt:'2026-10-24',pages:{1:{items:[{bvid:'a'}]}}});
 assert.equal(current.reportedTotal,4748);assert.equal(current.shortfall,4747);assert.equal(current.capturedAt,'2026-10-24');
 const duplicates=summarizeBrowserCapture({reportedTotal:2,expectedPages:2,scanComplete:true,paginationStable:true,pages:{1:{items:[{bvid:'a'}]},2:{items:[{bvid:'a'}]}}});
 assert.equal(duplicates.complete,false);assert.deepEqual(duplicates.duplicatePages,[[1,2]]);
});
