import {DEFAULT_FOLDER_COUNT_POLICY} from './reconciliation-policy.mjs';

function rowsFromCapture(capture) {
  return Object.entries(capture?.pages || {}).flatMap(([page, value]) => (value.items || []).map(item => ({...item, page: Number(page)})));
}

export function compareWorkbenchSnapshot(state, capture) {
  const remoteRows = rowsFromCapture(capture);
  const remoteIds = remoteRows.map(row => row.bvid).filter(Boolean);
  const remoteUnique = new Set(remoteIds);
  const localIds = new Set(Object.keys(state.videos || {}));
  const duplicateCount = remoteIds.length - remoteUnique.size;
  const pageFingerprints = new Map();
  const duplicatePages = [];
  for (const [page, value] of Object.entries(capture?.pages || {})) {
    const fingerprint = (value.items || []).map(item => item.bvid || '').join('|');
    if (!fingerprint) continue;
    if (pageFingerprints.has(fingerprint)) duplicatePages.push([pageFingerprints.get(fingerprint), Number(page)]);
    else pageFingerprints.set(fingerprint, Number(page));
  }
  const reportedTotal = Number.isInteger(capture?.reportedTotal) && capture.reportedTotal >= 0 ? capture.reportedTotal : null;
  const expectedPages = Number.isInteger(capture?.expectedPages) && capture.expectedPages > 0 ? capture.expectedPages : null;
  const pageNumbers = Object.keys(capture?.pages || {}).map(Number);
  const pageSize = Number.isInteger(capture?.pageSize) && capture.pageSize > 0 ? capture.pageSize : null;
  const pageCoverage = expectedPages === null ? [] : Array.from({length:expectedPages},(_,index)=>{
    const page=index+1;
    const observed=capture?.pages?.[page];
    const expected=pageSize === null || reportedTotal === null ? null : Math.max(0,Math.min(pageSize,reportedTotal-(page-1)*pageSize));
    const read=Array.isArray(observed?.items)?observed.items.length:null;
    return {page,read,expected,deficit:expected===null||read===null?null:Math.max(0,expected-read),capturedAt:observed?.capturedAt||null};
  });
  const allPagesPresent = expectedPages !== null && pageNumbers.length === expectedPages &&
    Array.from({length: expectedPages}, (_, index) => index + 1).every(page => pageNumbers.includes(page));
  const traversalComplete = allPagesPresent && capture?.traversalFinished === true && duplicateCount === 0;
  const expectedGap = !capture?.folderId || String(capture.folderId)===DEFAULT_FOLDER_COUNT_POLICY.folderId ? DEFAULT_FOLDER_COUNT_POLICY.expectedGap : 0;
  const actualGap = reportedTotal === null ? null : reportedTotal-remoteRows.length;
  const gapDeviation = actualGap === null ? null : actualGap-expectedGap;
  const gapStatus = !traversalComplete || actualGap === null ? 'pending_scan' : gapDeviation===0 ? 'normal' : 'deviation';
  const complete = reportedTotal !== null && allPagesPresent && capture?.scanComplete === true &&
    capture?.paginationStable === true && remoteRows.length === reportedTotal && duplicateCount === 0 && remoteIds.length === remoteRows.length;
  const added = [...remoteUnique].filter(id => !localIds.has(id));
  const missing = complete ? [...localIds].filter(id => !remoteUnique.has(id)) : [];
  return {
    generatedAt: new Date().toISOString(),
    source: capture?.source || null,
    reportedTotal,
    capturedAt: capture?.capturedAt || null,
    expectedPages,
    traversedPages: pageNumbers.length,
    traversalComplete,
    expectedGap,
    gapDeviation,
    gapStatus,
    countReconciled: reportedTotal !== null && remoteIds.length === reportedTotal && duplicateCount === 0,
    pageCoverage,
    readCardCount: remoteRows.length,
    remoteUniqueBvidCount: remoteUnique.size,
    localUniqueBvidCount: localIds.size,
    duplicateCount,
    duplicatePages,
    requiresContentReadinessCheck: duplicatePages.length > 0,
    unexplainedGap: reportedTotal === null ? null : Math.max(0, reportedTotal - remoteRows.length),
    completeness: complete ? 'complete' : 'partial_or_short_pages',
    added,
    missing,
    missingInterpretation: complete ? 'confirmed_absent_from_complete_snapshot' : 'not_classified_until_complete_snapshot',
    evidence: remoteRows.map(row => ({bvid: row.bvid, title: row.title, page: row.page, url: row.url}))
  };
}
