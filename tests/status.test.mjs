import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,createApp} from '../server.mjs';
test('guard blocks account-side work and does not affect local data',()=>{
 const s=summarize({inventory:{members:[{bvid:'BV1'},{bvid:'BV1'},{bvid:'BV2'}],complete:false,folder_status:[{title:'默认收藏夹',retrieved:3,reported:99,last_page:2,exhausted:false,last_error:'http_412'}]},classification:{summary:{categories:{英语:2,AI:1},review:1,invalid:0}},guard:{status:'blocked',reason:'http_412'},copy:{copied:{英语:55,AI:70,编程:16,体育:7}}});
 assert.equal(s.status,'platform_access_blocked');assert.equal(s.accountMutationsEnabled,false);assert.equal(s.snapshot.memberships,3);assert.equal(s.snapshot.distinctBvids,2);assert.equal(s.classification.categorized,3);assert.equal(s.sync.historicalCopies,148);assert.equal(s.sync.phase2Verified,0);assert.equal(s.folders[0].lastError,'http_412');
});
test('no source snapshot yields safe empty state',()=>{
 const s=summarize({});assert.equal(s.snapshot.memberships,0);assert.equal(s.accountMutationsEnabled,false);
});
test('web server only accepts GET and never exposes raw inventory routes',async()=>{
 const app=createApp();await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 try{const origin='http://127.0.0.1:'+app.address().port;
 const post=await fetch(origin+'/api/status',{method:'POST'});assert.equal(post.status,405);
 const raw=await fetch(origin+'/inventory-rescan-v2.json');assert.equal(raw.status,404);
 const status=await fetch(origin+'/api/status');assert.equal(status.status,200);assert.equal((await status.json()).accountMutationsEnabled,false);
 }finally{await new Promise(resolve=>app.close(resolve));}
});
