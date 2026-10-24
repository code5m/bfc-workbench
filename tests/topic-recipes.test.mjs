import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStarterTopics} from '../public/topic-recipes.js';
test('starter playlists preserve unique videos and order by learning stage',()=>{
 const rows=[{bvid:'a',title:'台球走位',topic:'体育'},{bvid:'b',title:'台球站位手架',topic:'体育'},{bvid:'c',title:'台球瞄准',topic:'体育'},{bvid:'d',title:'台球失效',topic:'失效收藏'}];
 const topic=buildStarterTopics(rows).find(x=>x.id==='billiards');
 assert.deepEqual(topic.items,['b','c','a']);assert.equal(topic.sections.b,'姿势与出杆');assert.equal(new Set(topic.items).size,topic.items.length);assert.ok(!topic.items.includes('d'));
});
test('pronunciation playlists do not include stock advice using the word 连读',()=>{
 const topics=buildStarterTopics([{bvid:'stock',topic:'财经商业',title:'炒股就是炒BOLL，连读10遍'},{bvid:'english',topic:'英语',title:'英语连读训练'}]);
 assert.deepEqual(topics.find(t=>t.id==='english-pronunciation').items,['english']);
});
