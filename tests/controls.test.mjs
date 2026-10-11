import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

test('all dashboard controls map to explicit UI elements',async()=>{
 const app=createApp();await new Promise(ok=>app.listen(0,'127.0.0.1',ok));
 try{
  const b='http://127.0.0.1:'+app.address().port;
  const html=await (await fetch(b)).text();
  for(const id of ['refresh-all','show-audit','backup-review','restore-review','undo-review','scan-help','sync-help','cleanup-help','export-plan','review-search','review-filter','prev','next']){
   assert.match(html,new RegExp('id="'+id+'"'));
  }
  const js=await (await fetch(b+'/app.js')).text();
  for(const id of ['refresh-all','show-audit','backup-review','restore-review','undo-review','scan-help','sync-help','cleanup-help']){
   assert.ok(js.includes("'"+id+"'"));
  }
  for(const url of ['/api/audit','/api/review/export','/api/health','/api/completion','/api/export-plan']){
   const r=await fetch(b+url);assert.equal(r.status,200,url);
  }
  const unauth=await fetch(b+'/api/review/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(unauth.status,403);
  const health=await (await fetch(b+'/api/health')).json();
  assert.equal(health.bilibiliNetworkRequests,0);
  const copy=await (await fetch(b+'/api/export-plan')).json();
  assert.equal(copy.accountWriteOperations,0);
 }finally{await new Promise(ok=>app.close(ok))}
});
