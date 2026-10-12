import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const read=async f=>readFile(join(process.cwd(),'public',f),'utf8');
test('top-level navigation exposes actual classification and sync screens',async()=>{
 const h=await read('index.html'),css=await read('style.css'),nav=await read('navigation.js');
 for(const value of ['overview','classification','sync']){
  assert.ok(h.includes('data-view-link="'+value+'"'));
  assert.ok(h.includes('data-view="'+value+'"'));
  assert.ok(nav.includes(value));
 }
 assert.ok(h.includes('id="library-topic-nav"'));
 assert.ok(h.includes('id="library-items"'));
 assert.ok(css.includes('data-active-view'));
 assert.ok(h.includes('/navigation.js'));
});
test('each shipped browser script parses with Node syntax checker',async()=>{
 const {readdir}=await import('node:fs/promises');
 const {spawnSync}=await import('node:child_process');
 for(const f of (await readdir('public')).filter(s=>s.endsWith('.js'))){
  const run=spawnSync(process.execPath,['--check',join('public',f)],{encoding:'utf8'});
  assert.equal(run.status,0,f+': '+run.stderr);
 }
});
