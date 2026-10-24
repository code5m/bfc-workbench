import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptReadbackPage} from '../lib/browser-readback.mjs';
const page={source:'authorized_browser_readback',scanId:'scan_20261024',reportedTotal:2,expectedPages:2,page:1,renderedPage:1,items:[{bvid:'BV1234567890',title:'one'}]};
test('readback rejects stale DOM and mixed scan evidence',()=>{
 const first=acceptReadbackPage(null,page);
 assert.throws(()=>acceptReadbackPage(first,{...page,page:2,renderedPage:2}),/page_content_not_advanced/);
 assert.throws(()=>acceptReadbackPage(first,{...page,scanId:'another_scan'}),/scan_identity/);
 assert.throws(()=>acceptReadbackPage(first,{...page,reportedTotal:3}),/total_changed/);
 assert.throws(()=>acceptReadbackPage(first,{...page,page:2}),/invalid_readback_evidence/);
 assert.equal(Object.keys(first.pages).length,1);
 const next=acceptReadbackPage(first,{...page,page:2,renderedPage:2,items:[{bvid:'BV0987654321'}]});
 assert.equal(Object.keys(next.pages).length,2);assert.equal(next.scanComplete,false);
});
