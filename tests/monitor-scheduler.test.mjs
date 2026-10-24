import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMonitor,saveMonitorConfig} from '../lib/workbench-monitor.mjs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('monitor configuration accepts only bounded intervals',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-monitor-'));
 assert.equal((await saveMonitorConfig(dir,{enabled:true,intervalMinutes:1})).config.intervalMinutes,null);
 assert.deepEqual((await loadMonitor(dir)).config,{enabled:true,intervalMinutes:null});
});
