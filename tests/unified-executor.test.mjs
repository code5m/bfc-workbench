import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {UnifiedExecutor,buildOfflinePlan} from '../lib/unified-executor.mjs';
const flow = {videos:[
 {bvid:'BV1234567890',title:'电影创作',sources:[{folderName:'默认收藏夹',folderId:1}],decision:'suggested',topic:'电影创作',targetFolder:'电影创作',syncState:'target_folder_missing'},
 {bvid:'BV1234567891',title:'英语',sources:[{folderName:'英语',folderId:2}],decision:'suggested',topic:'英语',targetFolder:'英语',syncState:'exists_in_target_snapshot'},
 {bvid:'BV1234567892',title:'未知',sources:[{folderName:'默认收藏夹',folderId:1}],decision:'unclassified',topic:null,syncState:'needs_review'},
]};
test('builds unique priority P0 plan and rejects duplicate videos',()=>{
 const plan=buildOfflinePlan(flow);assert.equal(plan.summary.total,3);assert.equal(plan.summary.defaultPriority,2);assert.equal(plan.items[0].priority,'P0_default');
 assert.throws(()=>buildOfflinePlan({videos:[flow.videos[0],flow.videos[0]]}),/duplicate/);
});
test('persists checkpoints, remains idempotent, no account requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-exec-'));
 try{
  await writeFile(join(dir,'account-access-guard.json'),JSON.stringify({status:'blocked',reason:'http_412'}));
  const e=new UnifiedExecutor({dataDir:dir,batchSize:1});
  const prepared=await e.prepare(flow);assert.equal(prepared.total,3);
  assert.equal((await e.prepare(flow)).id,prepared.id);
  const first=await e.step();assert.equal(first.cursor,1);
  const paused=await e.pause();assert.equal(paused.phase,'paused');
  const next=new UnifiedExecutor({dataDir:dir,batchSize:1});
  await next.resume();
  let result;
  for(let i=0;i<40;i++){result=await next.status();if(result.phase.startsWith('offline_complete'))break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(result.phase,'offline_complete_account_blocked');assert.equal(result.cursor,3);
  assert.equal(result.remoteRequests,0);assert.equal(result.accountWrites,0);assert.equal(result.verifiedAccountSync,0);
  const item=JSON.parse(await readFile(join(dir,'unified-executor-job.json'),'utf8'));
  assert.equal(item.items.find(v=>v.bvid==='BV1234567892').localStatus,'needs_manual_review');
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('persistent lock cannot be bypassed by a second instance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-lock-'));
 try{
  const e=new UnifiedExecutor({dataDir:dir});await writeFile(join(dir,'unified-executor.lock'),'existing');
  await assert.rejects(e.prepare(flow),/lock_busy_or_stale/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
