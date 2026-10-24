import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateWorkbenchState,restoreWorkbenchState,saveWorkbenchLibrary,loadWorkbenchState,summarizeWorkbenchState,updatePlaybackProgress} from '../lib/workbench-store.mjs';

test('workbench migration persists videos and browser topic state idempotently', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-workbench-'));
 const records=[{bvid:'BV1234567890',title:'第一节',sourceFolders:['默认']}];
 const input={source:'browser-local-storage',library:{topics:[{id:'topic',name:'专题',description:'',items:['BV1234567890'],chapters:['第一章'],sections:{'BV1234567890':'第一章'}}],categories:{'BV1234567890':'学习'},watched:{},last:null}};
 const first=await migrateWorkbenchState(dir,input,records);
 assert.equal(first.alreadyImported,false);assert.equal(first.importedVideos,1);
 assert.equal(summarizeWorkbenchState(first.state).topicItemCount,1);
 const second=await migrateWorkbenchState(dir,input,records);
 assert.equal(second.alreadyImported,true);
 assert.equal((await loadWorkbenchState(dir)).videos.BV1234567890.title,'第一节');
 assert.ok(JSON.parse(await readFile(join(dir,'workbench-state.previous.json'),'utf8')));
});

test('workbench writes reject stale revisions instead of overwriting another client', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-workbench-'));
 const records=[{bvid:'BV1234567890',title:'第一节'}];
 const library={topics:[],categories:{},watched:{},last:null};
 const first=await migrateWorkbenchState(dir,{library},records);
 const saved=await saveWorkbenchLibrary(dir,{...library,watched:{'BV1234567890':true}},first.state.revision,records);
 assert.equal(saved.library.watched.BV1234567890,true);
 await assert.rejects(()=>saveWorkbenchLibrary(dir,library,first.state.revision,records),/workbench_revision_conflict/);
});
test('workbench backup restores validated library and increments revision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-workbench-'));const records=[{bvid:'BV1234567890',title:'第一节'}];
 const created=await migrateWorkbenchState(dir,{library:{topics:[],categories:{},watched:{},last:null}},records);
 const restored=await restoreWorkbenchState(dir,{version:1,videos:created.state.videos,library:{topics:[{id:'one',name:'专题',items:['BV1234567890'],chapters:[],sections:{}}],categories:{},watched:{},last:null}},records);
 assert.equal(restored.revision,created.state.revision+1);assert.equal(restored.library.topics[0].items[0],'BV1234567890');
});
test('real playback progress requires a Bilibili event and stays separate from watched',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-workbench-'));const records=[{bvid:'BV1234567890',title:'第一节'}];
 const created=await migrateWorkbenchState(dir,{library:{topics:[],categories:{},watched:{},last:null}},records);
 const updated=await updatePlaybackProgress(dir,{bvid:'BV1234567890',seconds:12,duration:60,source:'bilibili',expectedRevision:created.state.revision},records);
 assert.equal(updated.library.progress.BV1234567890.seconds,12);assert.equal(updated.library.watched?.BV1234567890,undefined);
 await assert.rejects(()=>updatePlaybackProgress(dir,{bvid:'BV1234567890',seconds:12,duration:60,source:'opened_link',expectedRevision:updated.revision},records),/invalid_playback_progress/);
});
