import {readFile, writeFile, rename, chmod} from 'node:fs/promises';
import {join} from 'node:path';

const FILE = 'workbench-monitor.json';

async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } }
async function saveJson(path, value) {
 const temporary=`${path}.tmp-${process.pid}`;
 await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600});await chmod(temporary,0o600);await rename(temporary,path);
}
export async function loadMonitor(dataDir) {
 return (await readJson(join(dataDir,FILE))) || {version:1,config:{enabled:false,intervalMinutes:null},runs:[],updatedAt:null};
}
export async function saveMonitorConfig(dataDir, config) {
 const current=await loadMonitor(dataDir);
 const next={...current,config:{enabled:config?.enabled===true,intervalMinutes:Number.isInteger(config?.intervalMinutes)&&config.intervalMinutes>=5?config.intervalMinutes:null},updatedAt:new Date().toISOString()};
 await saveJson(join(dataDir,FILE),next);return next;
}
export async function recordMonitorRun(dataDir, diff) {
 const current=await loadMonitor(dataDir);
 const run={...diff,runAt:new Date().toISOString()};
 const next={...current,runs:[...current.runs,run].slice(-20),updatedAt:run.runAt};
 await saveJson(join(dataDir,FILE),next);return next;
}
