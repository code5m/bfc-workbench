#!/usr/bin/env node
import {homedir} from 'node:os';
import {join} from 'node:path';
import {auditLocalData,saveAuditReport} from '../lib/offline-acceptance.mjs';
const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const report=await auditLocalData(dir);
const target=await saveAuditReport(dir,report);
console.log(JSON.stringify({savedAt:target,verdict:report.finalVerdict,defaultFolder:report.defaultFolder,review:report.review,risks:report.risks},null,2));
