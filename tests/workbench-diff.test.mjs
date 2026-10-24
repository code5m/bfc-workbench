import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWorkbenchSnapshot} from '../lib/workbench-diff.mjs';

test('partial capture reports a gap without claiming local videos were removed',()=>{
 const state={videos:{BV1111111111:{},BV2222222222:{}}};
 const result=compareWorkbenchSnapshot(state,{source:'authorized_browser_readback',reportedTotal:3,pages:{1:{items:[{bvid:'BV1111111111',title:'one'}]}}});
 assert.equal(result.readCardCount,1);assert.equal(result.remoteUniqueBvidCount,1);assert.equal(result.unexplainedGap,2);
 assert.equal(result.completeness,'partial_or_short_pages');assert.deepEqual(result.missing,[]);
});

test('complete capture can classify missing videos separately from new videos',()=>{
 const state={videos:{BV1111111111:{},BV2222222222:{}}};
 const pages={};for(let page=1;page<=119;page++)pages[page]={items:page===1?[{bvid:'BV1111111111',title:'one'},{bvid:'BV3333333333',title:'new'}]:[]};
 const result=compareWorkbenchSnapshot(state,{reportedTotal:2,expectedPages:119,scanComplete:true,paginationStable:true,pages});
 assert.equal(result.completeness,'complete');assert.deepEqual(result.added,['BV3333333333']);assert.deepEqual(result.missing,['BV2222222222']);
});

test('missing totals stay unknown rather than defaulting to a historical count',()=>{
 const result=compareWorkbenchSnapshot({videos:{}},{pages:{1:{items:[]}}});
 assert.equal(result.reportedTotal,null);assert.equal(result.unexplainedGap,null);
 assert.equal(result.completeness,'partial_or_short_pages');
});

test('duplicate or unstable pages never authorize absence conclusions',()=>{
 const capture={reportedTotal:2,expectedPages:1,scanComplete:true,paginationStable:true,pages:{1:{items:[{bvid:'a'},{bvid:'a'}]}}};
 const result=compareWorkbenchSnapshot({videos:{missing:{}}},capture);
 assert.deepEqual(result.missing,[]);assert.equal(result.completeness,'partial_or_short_pages');
});

test('page labels advancing before content updates are detected as duplicate pages',()=>{
 const result=compareWorkbenchSnapshot({videos:{}},{reportedTotal:2,expectedPages:2,scanComplete:true,paginationStable:true,pages:{1:{items:[{bvid:'a'}]},2:{items:[{bvid:'a'}]}}});
 assert.deepEqual(result.duplicatePages,[[1,2]]);
 assert.equal(result.requiresContentReadinessCheck,true);
 assert.equal(result.completeness,'partial_or_short_pages');
});

test('page-level deficits retain evidence without claiming the identities of unread videos',()=>{
 const result=compareWorkbenchSnapshot({videos:{}},{reportedTotal:5,expectedPages:2,pageSize:3,pages:{1:{items:[{bvid:'a'},{bvid:'b'}]},2:{items:[{bvid:'c'}]}}});
 assert.deepEqual(result.pageCoverage.map(p=>p.deficit),[1,1]);
 assert.equal(result.unexplainedGap,2);assert.deepEqual(result.missing,[]);
});
test('full traversal does not imply a reconciled counter',()=>{
 const result=compareWorkbenchSnapshot({videos:{}},{reportedTotal:2,expectedPages:1,traversalFinished:true,pages:{1:{items:[{bvid:'a'}]}}});
 assert.equal(result.traversalComplete,true);assert.equal(result.countReconciled,false);assert.equal(result.unexplainedGap,1);
});
