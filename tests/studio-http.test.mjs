import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';

test('new landing page, management page and playlist modules are served separately',async()=>{
 const server=createApp();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const landing=await fetch(base+'/');assert.equal(landing.status,200);const html=await landing.text();
  assert.ok(html.includes('id="home-continue"'));assert.ok(html.includes('/manage#sync'));assert.ok(!html.includes('id="executor-panel"'));
  const management=await fetch(base+'/manage');assert.equal(management.status,200);assert.ok((await management.text()).includes('id="executor-panel"'));
  for(const name of ['studio.js','topic-recipes.js','library-state.js']){const response=await fetch(base+'/'+name);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);assert.ok((await response.text()).length>100);}
  const studioScript=await (await fetch(base+'/studio.js')).text();assert.match(studioScript,/api\/workbench\/state/);
  const studioHtml=await (await fetch(base+'/')).text();assert.match(studioHtml,/id="logout"/);
  const response=await fetch(base+'/api/library-current');
  if(response.status===200){const data=await response.json();assert.ok(Array.isArray(data.records));assert.equal(new Set(data.records.map(r=>r.bvid)).size,data.records.length);assert.equal(data.summary.total,data.records.length);}
  else{assert.equal(response.status,404);assert.equal((await response.json()).error,'classification_unavailable');}
  const state=await fetch(base+'/api/workbench/state');assert.equal(state.status,403);
  const ownerSession=await (await fetch(base+'/api/session')).json();
  const stateAuthorized=await fetch(base+'/api/workbench/state',{headers:{'X-Local-CSRF':ownerSession.token}});assert.equal(stateAuthorized.status,200);
  assert.equal((await stateAuthorized.json()).ok,true);
  const videos=await fetch(base+'/api/workbench/videos?page=1&limit=2',{headers:{'X-Local-CSRF':ownerSession.token}});assert.equal(videos.status,200);
  const videoPage=await videos.json();assert.ok(Array.isArray(videoPage.items));assert.equal(videoPage.items.length<=2,true);
  const privateResearch=await fetch(base+'/api/workbench/research/invalid');assert.equal(privateResearch.status,403);
  const session=await (await fetch(base+'/api/session')).json();
  const authorizedResearch=await fetch(base+'/api/workbench/research/invalid',{headers:{'X-Local-CSRF':session.token}});assert.ok([200,404].includes(authorizedResearch.status));
  const logout=await fetch(base+'/api/session/logout',{method:'POST',headers:{'X-Local-CSRF':session.token}});assert.equal(logout.status,200);
  const oldAfterLogout=await fetch(base+'/api/workbench/state',{headers:{'X-Local-CSRF':session.token}});assert.equal(oldAfterLogout.status,403);
  const newSession=await (await fetch(base+'/api/session')).json();const newAfterLogout=await fetch(base+'/api/workbench/state',{headers:{'X-Local-CSRF':newSession.token}});assert.equal(newAfterLogout.status,200);
  const capabilities=await fetch(base+'/api/capabilities');assert.equal(capabilities.status,200);const capabilityData=await capabilities.json();assert.equal(capabilityData.backend.topics,true);assert.equal(capabilityData.bilibili.accountWrites,false);assert.equal(capabilityData.platforms.android.buildVerified,false);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
