import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadMonitor,saveMonitorConfig,recordMonitorRun} from '../lib/workbench-monitor.mjs';

test('monitor configuration and run history persist with bounded history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bilibili-monitor-'));
 let monitor=await saveMonitorConfig(dir,{enabled:true,intervalMinutes:15});
 assert.deepEqual(monitor.config,{enabled:true,intervalMinutes:15});
 for(let i=0;i<22;i++)monitor=await recordMonitorRun(dir,{completeness:'partial_or_short_pages',unexplainedGap:i});
 const restored=await loadMonitor(dir);assert.equal(restored.runs.length,20);assert.equal(restored.runs.at(-1).unexplainedGap,21);
});
