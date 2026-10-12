// Offline reliability audit of the existing Bilibili data and scanner contract.
export function auditStrategy({inventory,guard,classification}={}){
 const status=inventory?.folder_status||[];
 const rows=inventory?.members||[];
 const flagged=[];
 const ids=new Set();
 for(const row of rows){
  const key=String(row.folder_id)+'/'+String(row.bvid);
  if(ids.has(key))flagged.push({code:'duplicate_membership',folder:row.folder_title,bvid:row.bvid});
  ids.add(key);
 }
 const unscanned=status.filter(f=>f.exhausted!==true).map(f=>({
  folder:String(f.title||''),lastAttemptPage:Number(f.last_page||1),
  observed:Number(f.retrieved||0),reported:Number(f.reported||0),error:f.last_error||null
 }));
 const guardBlocked=guard?.status==='blocked';
 const decisions=[
  {id:'remote_access',state:guardBlocked?'blocked':'requires_authorization',message:guardBlocked?'全账号熔断中：不得自动发送任何请求':'需人工确认平台正常授权后才能启用'},
  {id:'pagination',state:unscanned.length?'incomplete':'complete',message:'只以 has_more=false 判定目录结束；每页持久化断点，禁止按返回条数判断完成'},
  {id:'source_drift',state:'not_verified',message:'分页期间若收藏变化，页号可能漂移；必须执行完整回读对账，不能声称没有遗漏'},
  {id:'batch_writes',state:'disabled',message:'没有获准写入能力和目标回读前禁止写入'},
  {id:'default_cleanup',state:'disabled',message:'目标实时回读完成前禁止移出默认收藏夹'}
 ];
 return {readOnly:true,networkRequests:0,guardBlocked,
  observedMemberships:rows.length,scanComplete:inventory?.complete===true,
  unfinishedFolders:unscanned,duplicateMemberships:flagged,
  categoryRecommendations:Number(classification?.summary?.categorized||0),
  gates:decisions,readyForAccountSync:false,
  reviewedAt:new Date().toISOString()};
}
