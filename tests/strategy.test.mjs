import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStrategy} from '../lib/strategy-audit.mjs';
test('412 never unblocks writes and records unfinished folders',()=>{
 const result=auditStrategy({inventory:{complete:false,members:[{folder_id:1,folder_title:'默认收藏夹',bvid:'BV1234567890'}],folder_status:[{title:'默认收藏夹',last_page:86,retrieved:1678,reported:4599,exhausted:false,last_error:'http_412'}]},guard:{status:'blocked'},classification:{summary:{categorized:1153}}});
 assert.equal(result.guardBlocked,true);
 assert.equal(result.readyForAccountSync,false);
 assert.equal(result.networkRequests,0);
 assert.equal(result.unfinishedFolders[0].lastAttemptPage,86);
 assert.equal(result.unfinishedFolders[0].error,'http_412');
});
test('repeated folder/video memberships are explicitly flagged',()=>{
 const result=auditStrategy({inventory:{members:[{folder_id:1,bvid:'BV1234567890'},{folder_id:1,bvid:'BV1234567890'},{folder_id:2,bvid:'BV1234567890'}]}});
 assert.equal(result.duplicateMemberships.length,1);
});
