import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLibraryState,nextVideo,followingVideo,addToTopic,moveVideo,refreshCategoryTopics} from '../public/library-state.js';
test('saved playlist keeps chapter assignments, ordering, categories and watch progress',()=>{
 const input={topics:[{id:'one',name:'My topic',description:'A path',items:['b','a','a'],chapters:['Basics','Practice'],sections:{b:'Basics',a:'Practice'}}],categories:{a:'英语'},watched:{b:true},last:'b'};
 const state=validateLibraryState(JSON.parse(JSON.stringify(input)),new Set(['a','b','c']));
 assert.deepEqual(state.topics[0].items,['b','a']);assert.equal(state.topics[0].sections.a,'Practice');assert.equal(state.categories.a,'英语');assert.equal(nextVideo(state.topics[0],state.watched),'a');
 addToTopic(state.topics[0],['a','c']);assert.deepEqual(state.topics[0].items,['b','a','c']);
 assert.equal(moveVideo(state.topics[0],2,-1),true);assert.deepEqual(state.topics[0].items,['b','c','a']);assert.equal(moveVideo(state.topics[0],0,-1),false);
 const restored=validateLibraryState(JSON.parse(JSON.stringify(state)),new Set(['a','b','c']));assert.deepEqual(restored,state);
 restored.watched.a=true;restored.watched.c=true;assert.equal(nextVideo(restored.topics[0],restored.watched),null);
});
test('next lesson follows user order without jumping backwards to an earlier unwatched video',()=>{
 const t={items:['first','second','third']};
 assert.equal(followingVideo(t,'second',{}),'third');
 assert.equal(followingVideo(t,'third',{}),null);
 assert.equal(followingVideo(t,'first',{second:true}),'third');
});
test('automatic category shelves follow latest labels without overwriting curated playlists',()=>{
 const state={topics:[{id:'auto',name:'英语 · 收藏精选',description:'按主题整理的收藏。可自行划分章节并调整观看顺序。',items:['old'],chapters:['入门','进阶','实践'],sections:{}},{id:'custom',name:'英语 · 收藏精选',description:'按主题整理的收藏。可自行划分章节并调整观看顺序。',items:['old'],chapters:['入门','进阶','实践'],sections:{},customized:true}],categories:{}};
 refreshCategoryTopics(state,[{bvid:'new',topic:'英语'},{bvid:'old',topic:'财经商业'}]);
 assert.deepEqual(state.topics[0].items,['new']);assert.deepEqual(state.generatedTopicBackups.auto,['old']);assert.deepEqual(state.topics[1].items,['old']);
 const restored=validateLibraryState({...state,watched:{}},new Set(['old','new']));assert.equal(restored.topics[1].customized,true);
});
test('invalid backups cannot replace existing state',()=>{
 const ids=new Set(['a']);
 const baseline={topics:[{id:'one',name:'one',items:['a'],chapters:[],sections:{}}],categories:{},watched:{}};
 assert.throws(()=>validateLibraryState({...baseline,topics:[{...baseline.topics[0],items:['foreign']}]},ids));
 assert.throws(()=>validateLibraryState({...baseline,topics:[...baseline.topics,...baseline.topics]},ids));
 assert.throws(()=>validateLibraryState({...baseline,categories:[]},ids));
 assert.deepEqual(baseline.topics[0].items,['a']);
});
test('notes and real playback progress remain separate from manual completion',()=>{
 const state=validateLibraryState({topics:[{id:'one',name:'专题',notes:'主题笔记',items:['a'],chapters:[],sections:{}}],categories:{},watched:{a:true},notes:{a:'视频笔记'},progress:{a:{seconds:12,duration:60,source:'bilibili'}}},new Set(['a']));
 assert.equal(state.watched.a,true);assert.equal(state.notes.a,'视频笔记');assert.equal(state.progress.a.seconds,12);assert.equal(state.topics[0].notes,'主题笔记');
});
