import {createHash, randomUUID} from 'node:crypto';
import {appendFile, mkdir, open, readFile, rename, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setImmediate as nextTick} from 'node:timers/promises';

/**
 * Offline-first persistent job executor. No Bilibili client is imported.
 *
 * One BV ID = one planned work item, regardless of how many source folders
 * contain it. Each item is assessed locally, then remains gated for a future
 * authorized readback/write/cleanup implementation. "Locally assessed" never
 * counts as an account operation or verified sync.
 */
const VERSION = 1;
const FILE = 'unified-executor-job.json';
const LOCK = 'unified-executor.lock';
const AUDIT = 'unified-executor-audit.jsonl';
const BLOCKED_STATES = new Set(['http_401','http_403','http_412','http_429','api_-101','api_-111','api_-412']);
const time = () => new Date().toISOString();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const isDefault = v => v.sources?.some(s => s.folderName === '默认收藏夹');

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function savePrivate(path, value) {
  const temp = path + '.' + process.pid + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), {mode: 0o600, flag: 'wx'});
    await rename(temp, path);
  } finally { await unlink(temp).catch(() => {}); }
}
export function buildOfflinePlan(workflow) {
  if (!workflow || !Array.isArray(workflow.videos)) throw Error('workflow_required');
  const ids = new Set();
  const items = workflow.videos.map(video => {
    if (!/^BV[0-9A-Za-z]{8,20}$/.test(video.bvid) || ids.has(video.bvid)) {
      throw Error('invalid_or_duplicate_bvid');
    }
    ids.add(video.bvid);
    const topic = typeof video.topic === 'string' ? video.topic : null;
    return {
      id: digest([video.bvid, video.targetFolder || '']).slice(0, 20),
      bvid: video.bvid,
      title: String(video.title || '').slice(0, 160),
      sources: (video.sources || []).map(x => ({
        folderId: x.folderId, folderName: String(x.folderName || '')
      })),
      topic, targetFolder: video.targetFolder || null,
      decision: video.decision || 'unclassified',
      snapshotStatus: video.syncState || 'unknown',
      priority: isDefault(video) ? 'P0_default' : 'P1_other',
      localStatus: 'pending', nextStep: null
    };
  });
  items.sort((a, b) => (a.priority === b.priority ? a.bvid.localeCompare(b.bvid) : a.priority.localeCompare(b.priority)));
  const fingerprint = digest(items.map(x => [x.id,x.decision,x.topic,x.sources.map(s => s.folderId).sort()]));
  const p0 = items.filter(x => x.priority === 'P0_default').length;
  return {version: VERSION, fingerprint, items, summary: {total: items.length, defaultPriority: p0}};
}
function assessItem(item) {
  if (item.decision === 'invalid') return ['invalid_requires_disposition', 'manual_exception'];
  if (!item.topic || ['conflict','unclassified','description_review'].includes(item.decision)) {
    return ['needs_manual_review', 'classify_before_sync'];
  }
  if (item.snapshotStatus === 'target_folder_missing') return ['locally_assessed', 'create_or_identify_target_after_authorization'];
  // A previously observed target membership must still be verified live.
  return ['locally_assessed', 'verify_live_target_before_copy'];
}
export function summarizeJob(job, guard) {
  if (!job) return {exists: false, phase: 'not_prepared', blocked: guard?.status === 'blocked',
    remoteEnabled: false, remoteRequests: 0, accountWrites: 0};
  const statuses = {};
  for (const item of job.items || []) statuses[item.localStatus] = (statuses[item.localStatus] || 0) + 1;
  return {
    exists: true, id: job.id, phase: job.phase, createdAt: job.createdAt,
    updatedAt: job.updatedAt, fingerprint: job.fingerprint,
    total: job.items.length, cursor: job.cursor, remaining: job.items.length - job.cursor,
    defaultPriority: job.defaultPriority, statuses,
    blocked: guard?.status === 'blocked', blockReason: guard?.reason || null,
    remoteEnabled: false, remoteRequests: job.remoteRequests || 0,
    accountWrites: job.accountWrites || 0, verifiedAccountSync: 0,
    message: job.phase.startsWith('offline_complete')
      ? '本地任务已逐项评估；账号读取、复制、回读及清理仍需合规适配器'
      : '正在执行仅本地任务；不会请求 B站'
  };
}

/**
 * Exclusive lock per data directory. A stale lock is NOT automatically stolen.
 * This is intentionally conservative: clearing an orphan lock requires review.
 */
export class UnifiedExecutor {
  constructor({dataDir, batchSize = 40} = {}) {
    if (!dataDir) throw Error('data_dir_required');
    this.dataDir = dataDir;
    this.batchSize = Math.max(1, Math.min(100, Number(batchSize) || 40));
    this.active = false;
    this.pending = Promise.resolve();
    this.jobPath = join(dataDir, FILE);
    this.guardPath = join(dataDir, 'account-access-guard.json');
    this.auditPath = join(dataDir, AUDIT);
    this.lockPath = join(dataDir, LOCK);
  }
  async read() { return readJson(this.jobPath); }
  async guard() { return readJson(this.guardPath); }
  async status() { return summarizeJob(await this.read(), await this.guard()); }
  async transact(action, fn) {
    const execute = this.pending.then(async () => {
      await mkdir(this.dataDir, {recursive: true});
      let handle;
      try {
        handle = await open(this.lockPath, 'wx', 0o600);
        await handle.writeFile(JSON.stringify({pid:process.pid,action,createdAt:time()}));
        return await fn();
      } catch (e) {
        if (e.code === 'EEXIST') throw Error('executor_lock_busy_or_stale');
        throw e;
      } finally {
        if (handle) {
          await handle.close();
          await unlink(this.lockPath).catch(() => {});
        }
      }
    });
    this.pending = execute.catch(() => {});
    return execute;
  }
  async log(action, details = {}) {
    await appendFile(this.auditPath,
      JSON.stringify({at:time(),action,...details}) + '\n', {mode:0o600});
  }
  async prepare(workflow) {
    if (this.active) throw Error('executor_running');
    const plan = buildOfflinePlan(workflow);
    return this.transact('prepare', async () => {
      const previous = await this.read();
      if (previous?.fingerprint === plan.fingerprint && previous.phase !== 'cancelled') {
        return summarizeJob(previous, await this.guard());
      }
      if (previous?.phase === 'offline_running' && previous.ownerPid && previous.ownerPid !== process.pid) {
        throw Error('previous_job_requires_interruption_review');
      }
      if (previous) {
        const archive = join(this.dataDir, 'unified-executor-archive-' + previous.id + '.json');
        await savePrivate(archive, previous);
      }
      const job = {
        version:VERSION,id:randomUUID(),phase:'prepared_offline',createdAt:time(),
        updatedAt:time(),fingerprint:plan.fingerprint,cursor:0,items:plan.items,
        defaultPriority:plan.summary.defaultPriority,ownerPid:null,
        remoteRequests:0,accountWrites:0
      };
      await savePrivate(this.jobPath, job);
      await this.log('job_prepared', {jobId:job.id,total:job.items.length,defaultPriority:job.defaultPriority});
      return summarizeJob(job, await this.guard());
    });
  }
  async step() {
    return this.transact('offline_step', async () => {
      const job = await this.read();
      if (!job) throw Error('prepare_required');
      if (['cancelled','paused'].includes(job.phase)) return summarizeJob(job, await this.guard());
      if (job.phase.startsWith('offline_complete')) return summarizeJob(job, await this.guard());
      if (job.version !== VERSION) throw Error('unsupported_job_version');
      // Never invoke any remote adapter from an offline step.
      job.phase = 'offline_running';
      job.ownerPid = process.pid;
      const until = Math.min(job.cursor + this.batchSize, job.items.length);
      for (let i = job.cursor; i < until; i++) {
        const [state,next] = assessItem(job.items[i]);
        job.items[i].localStatus = state;
        job.items[i].nextStep = next;
      }
      job.cursor = until;
      if (job.cursor === job.items.length) {
        const guard = await this.guard();
        job.phase = guard?.status === 'blocked'
          ? 'offline_complete_account_blocked' : 'offline_complete_adapter_unavailable';
        job.ownerPid = null;
      }
      job.updatedAt = time();
      await savePrivate(this.jobPath, job);
      await this.log('offline_batch', {jobId:job.id,cursor:job.cursor,total:job.items.length,phase:job.phase});
      return summarizeJob(job, await this.guard());
    });
  }
  async start() {
    if (this.active) return this.status();
    const job = await this.read();
    if (!job) throw Error('prepare_required');
    if (job.phase === 'cancelled') throw Error('cancelled_job_requires_new_prepare');
    if (job.phase === 'paused') throw Error('resume_required');
    if (job.phase === 'offline_running' && job.ownerPid && job.ownerPid !== process.pid) {
      throw Error('previous_process_requires_resume');
    }
    if (job.phase.startsWith('offline_complete')) return this.status();
    this.active = true;
    // Fire-and-yield: one checkpointed batch per tick; the HTTP API remains responsive.
    this.pump().catch(() => { this.active = false; });
    return this.status();
  }
  async pump() {
    try {
      while (this.active) {
        const status = await this.step();
        if (status.phase !== 'offline_running') break;
        await nextTick();
      }
    } finally { this.active = false; }
  }
  async pause() {
    this.active = false;
    return this.transact('pause', async () => {
      const job = await this.read();
      if (!job) throw Error('prepare_required');
      if (job.phase === 'offline_running' || job.phase === 'prepared_offline') {
        job.phase = 'paused';job.ownerPid=null;job.updatedAt=time();
        await savePrivate(this.jobPath,job);
        await this.log('job_paused',{jobId:job.id,cursor:job.cursor});
      }
      return summarizeJob(job, await this.guard());
    });
  }
  async resume() {
    const job = await this.read();
    if (!job) throw Error('prepare_required');
    if (job.phase !== 'paused' && job.phase !== 'offline_running') throw Error('job_not_resumable');
    await this.transact('resume', async () => {
      const current = await this.read();
      if (!['paused','offline_running'].includes(current.phase)) throw Error('job_not_resumable');
      if (current.phase === 'offline_running' && current.ownerPid && current.ownerPid !== process.pid) {
        // No automatic takeover of a potentially active second executor.
        throw Error('foreign_job_requires_operator_review');
      }
      current.phase='prepared_offline';current.ownerPid=null;current.updatedAt=time();
      await savePrivate(this.jobPath,current);
      await this.log('job_resumed',{jobId:current.id,cursor:current.cursor});
    });
    return this.start();
  }
  async cancel() {
    this.active = false;
    return this.transact('cancel',async()=>{
      const job=await this.read();
      if (!job) throw Error('prepare_required');
      if (!job.phase.startsWith('offline_complete')) {
        job.phase='cancelled';job.ownerPid=null;job.updatedAt=time();
        await savePrivate(this.jobPath,job);
        await this.log('job_cancelled',{jobId:job.id,cursor:job.cursor});
      }
      return summarizeJob(job,await this.guard());
    });
  }
}
