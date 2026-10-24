import {readFile, writeFile, rename, chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateLibraryState} from '../public/library-state.js';

const STORE_NAME = 'workbench-state.json';
const BACKUP_NAME = 'workbench-state.previous.json';

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function atomicWrite(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, JSON.stringify(value, null, 2), {mode: 0o600});
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

function emptyState() {
  return {
    version: 1,
    revision: 0,
    ownerId: 'local-owner',
    videos: {},
    library: {topics: [], categories: {}, watched: {}, notes: {}, progress: {}, last: null},
    migration: {source: null, importedAt: null, sourceFingerprint: null},
    updatedAt: null
  };
}

function videoMap(records = []) {
  return Object.fromEntries(records.filter(row => row?.bvid).map(row => [row.bvid, {
    bvid: row.bvid,
    title: row.title || '未知标题',
    author: row.author || row.up主 || row.upper || null,
    sourceFolders: [...new Set((row.sourceFolders || row.folders || row.originalFolders || []).filter(Boolean))],
    raw: row
  }]));
}

export async function loadWorkbenchState(dataDir) {
  return (await readJson(join(dataDir, STORE_NAME))) || emptyState();
}

export async function migrateWorkbenchState(dataDir, input, records = []) {
  if (!input || typeof input !== 'object') throw new Error('invalid_workbench_state');
  const ids = new Set(records.map(row => row?.bvid).filter(Boolean));
  const library = validateLibraryState(input.library || input, ids);
  const videos = videoMap(records);
  const sourceFingerprint = createHash('sha256').update(JSON.stringify({ids: [...ids].sort(), topics: library.topics.map(topic => [topic.id, topic.items])})).digest('hex');
  const current = await loadWorkbenchState(dataDir);
  if (current.migration.sourceFingerprint === sourceFingerprint) {
    return {state: current, alreadyImported: true, importedVideos: Object.keys(current.videos).length};
  }
  const next = {
    version: 1,
    revision: (current.revision || 0) + 1,
    ownerId: 'local-owner',
    videos: Object.keys(videos).length ? videos : current.videos,
    library,
    migration: {source: input.source || 'browser-local-storage', importedAt: new Date().toISOString(), sourceFingerprint},
    updatedAt: new Date().toISOString()
  };
  await atomicWrite(join(dataDir, BACKUP_NAME), current);
  await atomicWrite(join(dataDir, STORE_NAME), next);
  return {state: next, alreadyImported: false, importedVideos: Object.keys(next.videos).length};
}

export async function saveWorkbenchLibrary(dataDir, libraryInput, expectedRevision, records = []) {
  const current = await loadWorkbenchState(dataDir);
  const currentRevision = Number.isInteger(current.revision) ? current.revision : 0;
  if (!Number.isInteger(expectedRevision) || expectedRevision !== currentRevision) {
    const error = new Error('workbench_revision_conflict');
    error.current = current;
    throw error;
  }
  const ids = new Set(records.map(row => row?.bvid).filter(Boolean));
  const library = validateLibraryState(libraryInput, ids);
  const next = {...current, revision: currentRevision + 1, library, updatedAt: new Date().toISOString()};
  await atomicWrite(join(dataDir, BACKUP_NAME), current);
  await atomicWrite(join(dataDir, STORE_NAME), next);
  return next;
}

export async function restoreWorkbenchState(dataDir, input, records = []) {
  if (!input || input.version !== 1 || !input.library || !input.videos) throw new Error('invalid_workbench_backup');
  const ids = new Set(records.map(row => row?.bvid).filter(Boolean));
  const library = validateLibraryState(input.library, ids);
  const current = await loadWorkbenchState(dataDir);
  const next = {...input, ownerId: 'local-owner', revision: (Number.isInteger(current.revision) ? current.revision : 0) + 1, library, updatedAt: new Date().toISOString()};
  await atomicWrite(join(dataDir, BACKUP_NAME), current);
  await atomicWrite(join(dataDir, STORE_NAME), next);
  return next;
}

export async function updatePlaybackProgress(dataDir, input, records = []) {
  const current = await loadWorkbenchState(dataDir), currentRevision = Number.isInteger(current.revision) ? current.revision : 0;
  const ids = new Set(records.map(row => row?.bvid).filter(Boolean));
  if (!input || !ids.has(input.bvid) || input.source !== 'bilibili' || !Number.isFinite(input.seconds) || !Number.isFinite(input.duration) || input.seconds < 0 || input.duration <= 0 || input.seconds > input.duration) throw new Error('invalid_playback_progress');
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== currentRevision) { const error=new Error('workbench_revision_conflict');error.current=current;throw error; }
  const progress={...(current.library.progress||{}),[input.bvid]:{seconds:input.seconds,duration:input.duration,source:'bilibili',updatedAt:new Date().toISOString()}};
  const next={...current,revision:currentRevision+1,library:{...current.library,progress},updatedAt:new Date().toISOString()};
  await atomicWrite(join(dataDir,BACKUP_NAME),current);await atomicWrite(join(dataDir,STORE_NAME),next);return next;
}

export function summarizeWorkbenchState(state) {
  return {
    version: state.version,
    revision: state.revision || 0,
    ownerId: state.ownerId,
    videoCount: Object.keys(state.videos || {}).length,
    topicCount: state.library?.topics?.length || 0,
    topicItemCount: (state.library?.topics || []).reduce((sum, topic) => sum + topic.items.length, 0),
    watchedCount: Object.keys(state.library?.watched || {}).length,
    categoryCount: Object.keys(state.library?.categories || {}).length,
    migration: {source: state.migration?.source || null, importedAt: state.migration?.importedAt || null, hasFingerprint: Boolean(state.migration?.sourceFingerprint)},
    updatedAt: state.updatedAt
  };
}
