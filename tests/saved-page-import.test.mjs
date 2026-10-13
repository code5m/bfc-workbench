import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 validateSavedPageInput,initialSavedPageStore,applySavedPageImport,
 summarizeSavedPageStore,loadSavedPageStore,saveSavedPageStore
} from '../lib/saved-page-import.mjs';

const input={
 folder:'生活',format:'saved_html',sourceName:'saved-webpage.html',
 entries:[
  {bvid:'BV1234567890',title:'生活知识'},
  {bvid:'BV1234567891',title:'另一个视频'},
  {bvid:'BV1234567890',title:'生活知识'}
 ]
};
test('offline page import validates folder and exact BV before any changes',()=>{
 const r=validateSavedPageInput(input,['生活','默认收藏夹']);
 assert.equal(r.entries.length,2);
 assert.equal(r.folder,'生活');
 assert.equal(r.hash.length,64);
 assert.throws(()=>validateSavedPageInput({...input,folder:'其他目录'},['生活']),/unknown_source_folder/);
 assert.throws(()=>validateSavedPageInput({...input,entries:[{bvid:'bad'}]},['生活']),/invalid_import_bvid/);
 assert.throws(()=>validateSavedPageInput({...input,format:'remote_request'},['生活']),/unsupported_import_format/);
 assert.throws(()=>validateSavedPageInput({...input,entries:[]},['生活']),/invalid_import_item_count/);
 assert.throws(()=>validateSavedPageInput({...input,entries:Array.from({length:201},()=>input.entries[0])},['生活']),/invalid_import_item_count/);
});
test('duplicate imports are idempotent and account sync stays zero',()=>{
 const verified=validateSavedPageInput(input,['生活']);
 const once=applySavedPageImport(initialSavedPageStore(),verified,'2026-10-13T00:00:00Z');
 const twice=applySavedPageImport(once.store,verified,'2026-10-13T00:01:00Z');
 assert.equal(once.imported,2);
 assert.equal(twice.imported,0);
 assert.equal(twice.alreadyImported,true);
 const stats=summarizeSavedPageStore(twice.store,[{bvid:'BV1234567890'}]);
 assert.equal(stats.stagedUnique,2);
 assert.equal(stats.notInSnapshot,1);
 assert.equal(stats.alreadyInSnapshot,1);
 assert.equal(stats.verifiedAccountSync,0);
 assert.equal(stats.accountWrites,0);
 assert.equal(stats.remoteRequests,0);
 assert.equal(stats.safeToSync,false);
});
test('one BV can have two source folders without duplicate unique video counts',()=>{
 const a=validateSavedPageInput(input,['生活','默认收藏夹']);
 const b=validateSavedPageInput({...input,folder:'默认收藏夹',entries:input.entries.slice(0,1)},['生活','默认收藏夹']);
 const once=applySavedPageImport(initialSavedPageStore(),a,'2026-10-13T00:00:00Z');
 const twice=applySavedPageImport(once.store,b,'2026-10-13T00:02:00Z');
 assert.equal(twice.uniqueItems,2);
 assert.equal(twice.imported,0);
 assert.equal(twice.store.items.find(x=>x.bvid==='BV1234567890').observations.length,2);
 const sum=summarizeSavedPageStore(twice.store,[]);
 assert.equal(sum.folders['生活'],2);
 assert.equal(sum.folders['默认收藏夹'],1);
});
test('persist only staged private metadata, not source page HTML',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-import-test-'));
 try{
  const importData=validateSavedPageInput(input,['生活']);
  const report=applySavedPageImport(initialSavedPageStore(),importData,'2026-10-13T00:00:00Z');
  await saveSavedPageStore(dir,report.store);
  const loaded=await loadSavedPageStore(dir);
  assert.deepEqual(loaded,report.store);
  assert.equal((await stat(join(dir,'saved-page-import-staging.json'))).mode&0o777,0o600);
  const stored=await readFile(join(dir,'saved-page-import-staging.json'),'utf8');
  assert.doesNotMatch(stored,/<html>|Cookie:|SESSDATA=/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('HTTP import is localhost-only and requires anti-CSRF token',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bili-import-http-'));
 const old=process.env.BILIBILI_FAVORITES_DATA_DIR;
 process.env.BILIBILI_FAVORITES_DATA_DIR=dir;
 let app;
 try{
  await writeFile(join(dir,'inventory-rescan-v2.json'),JSON.stringify({
   members:[{bvid:'BV1234567890'}],
   folder_status:[{title:'生活',retrieved:0,reported:5,exhausted:false}]
  }));
  const {createApp}=await import('../server.mjs');
  app=createApp();
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.address().port;
  const json=async r=>({status:r.status,body:await r.json()});
  const session=await json(await fetch(base+'/api/session'));
  const forbidden=await json(await fetch(base+'/api/saved-page-import',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
  }));
  assert.equal(forbidden.status,403);
  const allowed=await json(await fetch(base+'/api/saved-page-import',{
   method:'POST',headers:{
    'Content-Type':'application/json',Origin:base,'X-Local-CSRF':session.body.token
   },body:JSON.stringify(input)
  }));
  assert.equal(allowed.status,200);
  assert.equal(allowed.body.stagedUnique,2);
  assert.equal(allowed.body.notInSnapshot,1);
  assert.equal(allowed.body.accountWrites,0);
  const report=await json(await fetch(base+'/api/saved-page-import'));
  assert.equal(report.body.savedPages,1);
  const items=await json(await fetch(base+'/api/saved-page-import/items?folder=%E7%94%9F%E6%B4%BB'));
  assert.equal(items.body.total,2);
  assert.ok(items.body.items.every(x=>x.accountSyncVerified===false));
 }finally{
  if(app)await new Promise(resolve=>app.close(resolve));
  if(old===undefined)delete process.env.BILIBILI_FAVORITES_DATA_DIR;
  else process.env.BILIBILI_FAVORITES_DATA_DIR=old;
  await rm(dir,{recursive:true,force:true});
 }
});
