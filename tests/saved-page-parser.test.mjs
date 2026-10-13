import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSavedHtmlVideos,extractSavedJsonVideos} from '../public/saved-page-parser.js';

test('saved HTML extracts exact Bilibili video links and decodes title safely',()=>{
 const input='<a title="AI &amp; 剪辑" href="https://www.bilibili.com/video/BV1234567890?x=1">页面内容</a>'+
  '<a href="/video/BV1234567891/"><img alt="第二条" src="https://external.invalid/some-image"></a>'+
  '<a href="https://evil.example.com/video/BV1234567892">伪造链接</a>'+
  '<a href="https://www.bilibili.com/video/BV1234567890">重复</a>';
 const result=extractSavedHtmlVideos(input);
 assert.equal(result.length,2);
 assert.deepEqual(result.find(v=>v.bvid==='BV1234567890'),{bvid:'BV1234567890',title:'AI & 剪辑'});
 assert.equal(result.find(v=>v.bvid==='BV1234567891').title,'第二条');
 assert.equal(result.some(x=>x.bvid==='BV1234567892'),false);
});
test('HTML parsing leaves scripts and images as inert text',()=>{
 globalThis.__maliciousImageLoads=0;
 const input='<script>globalThis.__maliciousImageLoads+=1</script>'+
  '<a href="https://www.bilibili.com/video/BV1234567890">'+
  '<img src="https://example.invalid/private" onload="globalThis.__maliciousImageLoads+=1" alt="有效视频"></a>';
 const result=extractSavedHtmlVideos(input);
 assert.equal(result.length,1);
 assert.equal(globalThis.__maliciousImageLoads,0);
 delete globalThis.__maliciousImageLoads;
});
test('saved JSON extracts only structured BV entries, never tokens',()=>{
 const input=JSON.stringify({
  token:'secret',
  data:{medias:[
   {bvid:'BV1234567890',title:'视频A',SESSDATA:'top secret'},
   {bv_id:'BV1234567891',title:'视频B'}
  ]},
  otherStuff:{bvid:'BV1234567892',title:'不遍历任意键'}
 });
 const results=extractSavedJsonVideos(input);
 assert.equal(results.length,2);
 assert.equal(results.find(x=>x.bvid==='BV1234567891').title,'视频B');
 assert.equal(results.some(x=>x.bvid==='BV1234567892'),false);
 assert.equal(JSON.stringify(results).includes('secret'),false);
});
test('no quiet clipping of large imported pages at 200 items',()=>{
 const rows=Array.from({length:205},(_,i)=>({
  bvid:'BV'+i.toString(36).toUpperCase().padStart(10,'0'),
  title:'视频'+i
 }));
 const parsed=extractSavedJsonVideos(JSON.stringify({entries:rows}));
 assert.equal(parsed.length,201);
});
