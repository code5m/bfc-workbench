// The completion gate has one job: never confuse local preparation with account-side delivery.
// Live Bilibili requests are forbidden in this module. Account evidence must be provided separately.
export const DELIVERY_GOAL=Object.freeze({
 id:'complete-bilibili-favorites',
 title:'默认收藏夹必须全部整理并同步到 B站账号',
 priority:'P0',
 definition:'完整读取全部收藏夹；把默认收藏夹中的有效视频分类、同步、回读确认后安全移出；复核失效和例外条目；确保无视频意外丢失。',
 contract:'docs/COMPLETION_CONTRACT.md',
});
const clamp=(n)=>Math.max(0,Number.isFinite(Number(n))?Number(n):0);
function proof(evidence,id){
 const p=evidence?.proofs?.[id];
 return p?.result==='pass' && p?.source==='authorized_bilibili_readback' &&
   typeof p?.recordedAt==='string' && Number.isFinite(Date.parse(p.recordedAt)) &&
   typeof p?.evidenceRef==='string' && p.evidenceRef.length>0;
}
export function assessCompletion({inventory,workflow,guard,finalEvidence}={}){
 const folders=Array.isArray(inventory?.folder_status)?inventory.folder_status:[];
 const defaultFolder=folders.find(x=>x.title==='默认收藏夹');
 const displayed=defaultFolder?clamp(defaultFolder.reported):null;
 const read=defaultFolder?clamp(defaultFolder.retrieved):null;
 const observedIncomplete=defaultFolder?defaultFolder.exhausted!==true:true;
 const missingEstimate=defaultFolder?Math.max(0,displayed-read):null;
 const stats=workflow?.stats||{};
 const blocked=guard?.status==='blocked' || workflow?.blocked===true;
 const fullScan=inventory?.complete===true && folders.length>0 && folders.every(x=>x.exhausted===true);
 const defaultFullScan=Boolean(defaultFolder&&defaultFolder.exhausted===true);
 const unresolved=clamp(stats.conflict)+clamp(stats.unclassified)+clamp(stats.descriptionReview);
 const invalid=clamp(stats.invalid);
 const invalidHandled=invalid===0 || (finalEvidence?.invalidDisposition?.accountedFor===invalid &&
   typeof finalEvidence?.invalidDisposition?.evidenceRef==='string' && Boolean(finalEvidence.invalidDisposition.evidenceRef));
 const allClassified=clamp(stats.unique)>0 && unresolved===0 && invalidHandled &&
   clamp(stats.classified)+clamp(stats.manual)+invalid===clamp(stats.unique);
 const defaultRemaining=Number.isSafeInteger(finalEvidence?.defaultFolder?.remainingActionable)?
   finalEvidence.defaultFolder.remainingActionable:null;
 const defaultResidualVerified=defaultRemaining===0 && finalEvidence?.defaultFolder?.fullyScanned===true &&
   finalEvidence?.defaultFolder?.exceptionsDocumented===true;
 function gate(id,title,pass,{requiresAccess=false,detail='' }={}){
   return {id,title,status:pass?'passed':(requiresAccess&&blocked?'blocked':'pending'),detail};
 }
 const gates=[
  gate('G1','B站正常授权访问并提供真实回读证明',!blocked&&proof(finalEvidence,'access'),{
   requiresAccess:true,detail:blocked?'HTTP 412 账号级熔断仍生效；禁止自动重试':'等待合法账号访问与回读证据'}),
  gate('G2','完整扫描全部收藏夹（含默认收藏夹）',fullScan&&defaultFullScan,{
   requiresAccess:true,detail:defaultFolder
      ?('默认收藏夹已读 '+read+' / 历史报告 '+displayed+' 条；'+
        (observedIncomplete?'未读完，第 '+clamp(defaultFolder.last_page)+' 页受阻':'分页已完成'))
      :'尚未取得默认收藏夹快照'}),
  gate('G3','全部有效视频完成可靠分类并处置失效条目',allClassified,{
   detail:unresolved+' 个唯一视频待分类或冲突复核；'+invalid+' 个失效视频需单独处置'}),
  gate('G4','目标收藏夹建立且所有 BV 号实时去重验证',
   clamp(stats.needsTargetCreate)===0 && proof(finalEvidence,'targets'),{
    requiresAccess:true,detail:clamp(stats.needsTargetCreate)+' 个视频对应的目标目录在本地快照中未找到；需要目标实时核验'}),
  gate('G5','全部应同步视频实际写入并逐条回读验收',
   proof(finalEvidence,'sync')&&clamp(finalEvidence?.sync?.pendingUnverified)===0,{
    requiresAccess:true,detail:'必须由获准的账号写入工具完成；仅有本地分类或复制请求日志不足以通过'}),
  gate('G6','默认收藏夹全部处理并安全清理原始关系',
   defaultResidualVerified&&proof(finalEvidence,'default_cleanup'),{
    requiresAccess:true,detail:defaultResidualVerified?'待核对清理证据':'目前没有默认夹剩余有效视频为 0 的实时完整回读证据'}),
  gate('G7','跨收藏夹无意外丢失、无重复错误且有恢复证据',
   proof(finalEvidence,'integrity')&&finalEvidence?.integrity?.unintendedLoss===0,{
    requiresAccess:true,detail:'必须完成真实对账并保存恢复证据'}),
 ];
 const coreAllPassed=gates.every(x=>x.status==='passed');
 gates.push(gate('G8','最终验收报告全部通过并封存',coreAllPassed&&proof(finalEvidence,'final_acceptance'),{
    requiresAccess:true,detail:'全部前置 G1-G7 通过后方可完成最终验收'}));
 const allDone=gates.every(x=>x.status==='passed');
 return {
  goal:DELIVERY_GOAL,overallStatus:allDone?'ALL_DONE':'NOT_DONE',allDone,
  blockers:gates.filter(x=>x.status!=='passed').map(x=>x.id),
  passed:gates.filter(x=>x.status==='passed').length,total:gates.length,gates,
  defaultFolder:{
   exists:Boolean(defaultFolder),historicalReported:displayed,observed:read,
   notObservedEstimate:missingEstimate,
   observedRatio:displayed?Math.round((read/displayed)*1000)/10:0,
   scanFinished:defaultFullScan,nextPage:observedIncomplete?clamp(defaultFolder?.last_page):null,
   lastError:defaultFolder?.last_error||null,
   accountConfirmedRemoved:finalEvidence?.defaultFolder?.verifiedRemovedCount??null,
   actionableRemainingConfirmed:defaultRemaining,
   cleared:defaultResidualVerified&&proof(finalEvidence,'default_cleanup'),
   note:'历史报告数量可能包含失效、不可见或变化条目；读取覆盖率不等于整理完成率。',
  },
  basis:{savedMemberships:clamp(stats.memberships),uniqueBvids:clamp(stats.unique),
   historicalCopies:clamp(stats.historicalCopied),secondRoundVerified:clamp(stats.phase2Verified),
   pendingLocalReview:unresolved,invalid:invalid,scanComplete:fullScan,platformBlocked:blocked},
  lastEvaluatedAt:new Date().toISOString(),
 };
}
