const $=id=>document.getElementById(id);
let session=null,currentPage=1,currentState='review',currentQuery='';
const format=n=>new Intl.NumberFormat('zh-CN').format(n??0);
function elem(parent,tag,value,cls){const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(cls)el.className=cls;parent.append(el);return el;}
function drawCompletion(result){
 if(!result)return;
 const info=result.defaultFolder||{};
 $('completion-status').textContent=result.allDone?'全部完成 · 已验收':'未完成 · 必须继续';
 $('completion-status').className='completion-state '+(result.allDone?'passed':'unmet');
 $('default-reported').textContent=info.historicalReported===null?'未知':format(info.historicalReported);
 $('default-observed').textContent=info.observed===null?'未知':format(info.observed);
 $('default-unseen').textContent=info.notObservedEstimate===null?'未知':format(info.notObservedEstimate);
 $('default-cleared').textContent=info.accountConfirmedRemoved===null?'尚无回读证据':format(info.accountConfirmedRemoved);
 const pct=Math.max(0,Math.min(100,Number(info.observedRatio)||0));
 $('default-coverage').textContent=pct.toFixed(1)+'%';
 $('default-read-bar').style.width=pct+'%';
 $('completion-gate-count').textContent=result.passed+'/'+result.total+' 项真实通过';
 const out=$('completion-gates');out.replaceChildren();
 for(const g of result.gates||[]){
   const row=elem(out,'div',undefined,'completion-gate');
   elem(row,'span',g.id,'gate-index');
   const details=elem(row,'div',undefined,'gate-details');
   elem(details,'b',g.title);
   elem(details,'small',g.detail);
   const state=g.status==='passed'?'已通过':g.status==='blocked'?'受阻':'未通过';
   elem(row,'span',state,'gate-state '+g.status);
 }
}
function drawStatus(d){
 const blocked=d.access.blocked;
 $('access').textContent=blocked?'访问状态：HTTP 412 安全暂停':'访问状态：仅本地分析';
 $('access').className=blocked?'pill blocked':'pill';
 $('headline').textContent=blocked?'平台访问已暂停，本地整理正常进行':'本地分类工作台运行正常';
 $('subhead').textContent=blocked?'B站接口熔断生效。可以离线复核分类，但无法同步账号。':'页面仅使用本机数据。';
 $('memberships').textContent=format(d.snapshot.memberships);
 $('unique').textContent=format(d.snapshot.distinctBvids);
 $('classified').textContent=format(d.workflow.stats.classified+d.workflow.stats.manual+d.workflow.stats.assistantReviewed);
 $('copied').textContent=format(d.sync.historicalCopies);
 $('coverage').textContent=d.snapshot.memberships?Math.round(100*(d.workflow.stats.classified+d.workflow.stats.manual+d.workflow.stats.assistantReviewed)/d.snapshot.distinctBvids)+'%':'—';
 const topics=$('topics');topics.replaceChildren();
 const data=d.workflow.stats.topics;const max=Math.max(1,...Object.values(data));
 Object.entries(data).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
  const w=elem(topics,'div','','topic'),lab=elem(w,'div','','topic-label');
  elem(lab,'span',name);elem(lab,'b',format(count));
  const track=elem(w,'div','','track');elem(track,'div','','fill').style.width=(count/max*100)+'%';
 });
 const actions=$('actions');actions.replaceChildren();
 d.workflow.milestones.forEach((a,i)=>{
  const w=elem(actions,'div','','action');elem(w,'span',String(i+1).padStart(2,'0'),'step');
  const v=elem(w,'div','','action-body');elem(v,'b',a.label);
  elem(w,'span',a.status==='blocked'?'阻塞':a.status==='completed'?'完成':a.status==='in_progress'?'进行中':'待处理','state '+(a.status==='blocked'?'blocked':''));
 });
 const folders=$('folders');folders.replaceChildren();
 d.folders.forEach(f=>{
  const w=elem(folders,'div','','folder');const label=elem(w,'div','','folder-label');
  elem(label,'b',f.name);elem(label,'span',f.complete?'已遍历':'待续扫','folder-state '+(f.complete?'ok':'warn'));
  const meta=elem(w,'div','','folder-meta');elem(meta,'span',format(f.read)+' 条已读');elem(meta,'span',f.complete?'已结束':f.lastError?'受阻：'+f.lastError:'下一页：'+f.nextPage);
  const track=elem(w,'div','','track');const fill=elem(track,'div','','fill '+(f.complete?'green':''));
  fill.style.width=(f.reported?Math.min(100,Math.round(f.read/f.reported*100)):f.complete?100:0)+'%';
 });
 $('coverage-label').textContent=d.folders.filter(f=>f.complete).length+'/'+d.folders.length+' 个文件夹完成遍历';
 $('local-review-stats').textContent='待复核 '+format(d.workflow.stats.conflict+d.workflow.stats.descriptionReview+d.workflow.stats.unclassified)+' 条 · 冲突 '+d.workflow.stats.conflict+' 条 · 本地确认 '+d.workflow.stats.manual+' 条';
 drawCompletion(d.completion);
 const live=d.liveBrowserCapture||{};
 $('live-browser-reported').textContent=format(live.reportedTotal);
 $('live-browser-pages').textContent=(live.pages??0)+'/119';
 $('live-browser-items').textContent=format(live.items);
 $('live-browser-shortfall').textContent=format(live.shortfall);
 $('live-browser-state').textContent=live.complete?'已完整读取':'存在差异，继续核验';
 $('live-browser-state').className='completion-state '+(live.complete?'passed':'unmet');
 $('live-browser-detail').textContent=live.complete?'已读取浏览器页面宣称的全部条目。':'浏览器页面已逐页接通；实际 DOM 条目少于页面总数，差异不会被补造或标记为完成。';
 $('updated').textContent='最近刷新：'+new Date().toLocaleString('zh-CN');
}
async function refresh(){
 try{
  const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  const payload=await r.json();drawStatus(payload);if(payload.executor)drawExecutor(payload.executor);
 }catch(e){$('headline').textContent='本地状态读取失败';$('subhead').textContent=String(e);}
}
async function readVideos(){
 try{
  const params=new URLSearchParams({state:currentState,page:currentPage,q:currentQuery});
  const r=await fetch('/api/videos?'+params);if(!r.ok)throw Error('读取失败');
  const data=await r.json(),out=$('review-items');out.replaceChildren();
  $('review-total').textContent='共 '+format(data.count)+' 条，第 '+data.page+' 页';
  $('prev').disabled=currentPage<=1;$('next').disabled=currentPage*data.limit>=data.count;
  for(const item of data.items){
   const w=elem(out,'div','','review-item'),left=elem(w,'div','','review-main');
   const t=elem(left,'a',item.title||'无标题','review-title');t.href=item.url;t.target='_blank';t.rel='noopener noreferrer';
   elem(left,'small',item.bvid+' · 原目录：'+item.sources.map(x=>x.folderName).join(' / '));
   const candidates=item.candidateTopics.length?item.candidateTopics.join(' / '):item.suggestion?'简介建议：'+item.suggestion:'暂未识别';
   elem(left,'small','分类线索：'+candidates+' · 状态：'+item.decision);
   const right=elem(w,'div','','review-control');const select=elem(right,'select');
   const placeholder=elem(select,'option','选择本地分类');placeholder.value='';
   for(const cat of session.categories){const opt=elem(select,'option',cat);opt.value=cat;}
   if(item.topic)select.value=item.topic;
   const save=elem(right,'button','确认分类','save-review');
   save.onclick=async()=>{
    if(!select.value){$('review-message').textContent='请先选择分类';return;}
    save.disabled=true;
    try{
     const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:JSON.stringify({bvid:item.bvid,topic:select.value})});
     const result=await r.json();if(!r.ok)throw Error(result.error||'保存失败');
     lastManualBvid=item.bvid;
     $('review-message').textContent='已保存本地分类：'+item.title+' → '+select.value+'（未同步至B站）';
     await Promise.all([readVideos(),refresh()]);
    }catch(e){$('review-message').textContent=String(e);}finally{save.disabled=false;}
   };
  }
 }catch(e){$('review-message').textContent=String(e);}
}
async function bootstrap(){
 try{const r=await fetch('/api/session');if(!r.ok)throw Error('缺少本地复核会话');session=await r.json();}
 catch(e){$('review-message').textContent=String(e);return;}
 $('review-search').oninput=e=>{currentQuery=e.target.value;currentPage=1;readVideos();};
 $('review-filter').onchange=e=>{currentState=e.target.value;currentPage=1;readVideos();};
 $('prev').onclick=()=>{currentPage=Math.max(1,currentPage-1);readVideos();};
 $('next').onclick=()=>{currentPage++;readVideos();};
 $('export-plan').onclick=()=>{window.location.href='/api/export-plan';};
 await readVideos();
}
let lastManualBvid=null;
async function showAudit(){
 const r=await fetch('/api/audit');if(!r.ok)throw Error('读取审计失败');
 const d=await r.json(),out=$('audit-rows');out.replaceChildren();
 elem(out,'h4','最近本地审核操作');
 if(!d.logs.length)elem(out,'p','尚无人工审核操作记录','muted');
 for(const log of d.logs){
  const text=[log.when||'',log.action||'',log.bvid||'',log.topic||'',log.count??''].filter(Boolean).join(' · ');
  elem(out,'div',text,'audit-line');
 }
}
function help(kind){
 const messages={
 scan:'扫描尚未开放：当前 B站 HTTP 412 熔断生效。不能在页面绕过账号保护；需要平台正常授权恢复，之后才可安全续读。',
 sync:'账号同步尚未开放：需要获准的写入工具、目标收藏夹实时去重、逐批写入和回读证明。导出的 JSON 只是离线计划。',
 cleanup:'清理默认收藏夹尚未开放：必须先完成全部分页读取、确认目标收藏成功并回读，再在明确授权下安全移出，且须保留恢复证据。',
 };
 $('action-help').textContent=messages[kind]||'';
}
async function wireControls(){
 $('refresh-all').onclick=async()=>{await Promise.all([refresh(),readVideos()]);$('action-help').textContent='已刷新本地文件（没有访问 B站）。';};
 $('show-audit').onclick=async()=>{try{await showAudit();$('action-help').textContent='本地审核日志已展开。';}catch(e){$('action-help').textContent=String(e);}};
 $('backup-review').onclick=()=>{window.location.href='/api/review/export';$('action-help').textContent='已请求导出本地人工分类备份。';};
 $('restore-review').onclick=()=>$('restore-file').click();
 $('restore-file').onchange=async(e)=>{
  const f=e.target.files?.[0];if(!f)return;
  if(f.size>4096){$('action-help').textContent='备份文件超过 4KB 限额。请先拆分，不能绕过接口限制。';return;}
  try{
   const data=JSON.parse(await f.text());
   if(!window.confirm('只恢复本地人工分类，不修改 B站账号。是否继续？'))return;
   const r=await fetch('/api/review/restore',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:JSON.stringify(data)});
   const result=await r.json();if(!r.ok)throw Error(result.error);
   $('action-help').textContent='成功恢复 '+result.restored+' 条本地人工分类；原备份已保存。';
   await Promise.all([refresh(),readVideos()]);
  }catch(error){$('action-help').textContent='恢复失败：'+String(error);}
  finally{$('restore-file').value='';}
 };
 $('undo-review').onclick=async()=>{
  if(!lastManualBvid){$('action-help').textContent='本次页面会话尚无可以撤销的人工分类。';return;}
  if(!window.confirm('撤销 '+lastManualBvid+' 的本地人工分类？'))return;
  try{
   const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:JSON.stringify({bvid:lastManualBvid,topic:null})});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   $('action-help').textContent='本地分类已撤销（没有修改 B站）。';lastManualBvid=null;
   await Promise.all([refresh(),readVideos()]);
  }catch(e){$('action-help').textContent=String(e);}
 };
 $('scan-help').onclick=()=>help('scan');
 $('sync-help').onclick=()=>help('sync');
 $('cleanup-help').onclick=()=>help('cleanup');
}
refresh();bootstrap().then(wireControls);setInterval(refresh,30000);


function drawExecutor(status){
 if(!status)return;
 const phase=status.phase||'not_prepared';
 $('executor-phase').textContent=phase==='not_prepared'?'未准备':phase.startsWith('offline_complete')?'离线任务已完成':phase==='paused'?'已暂停':phase==='cancelled'?'已取消':phase==='offline_running'?'本地执行中':'待执行';
 $('executor-phase').className='completion-state '+(phase.startsWith('offline_complete')?'passed':'unmet');
 $('executor-counter').textContent=(status.cursor||0)+' / '+(status.total||0)+' 项已检查';
 $('executor-blocked').textContent=status.blocked?'HTTP 412 已保护 · 账号操作锁定':'仅离线 · 无账号适配器';
 const pct=status.total?Math.round(status.cursor/status.total*100):0;
 $('executor-progress').style.width=pct+'%';
 $('executor-states').textContent=Object.entries(status.statuses||{}).map(([state,count])=>state+': '+count).join(' · ');
 for(const action of ['prepare','start','pause','resume','cancel']){
  const btn=$('exec-'+action);if(!btn)continue;
  btn.disabled=(action==='start'&&!['prepared_offline','offline_running'].includes(phase))
   ||(action==='resume'&&phase!=='paused')
   ||(action==='pause'&&!['offline_running','prepared_offline'].includes(phase))
   ||(action==='cancel'&&(phase==='not_prepared'||phase==='cancelled'||phase.startsWith('offline_complete')));
 }
}
async function loadExecutor(){
 try{const r=await fetch('/api/executor',{cache:'no-store'});if(!r.ok)throw Error('status '+r.status);drawExecutor(await r.json());}
 catch(e){$('executor-message').textContent='执行器读取失败：'+String(e);}
}
async function runExecutorAction(action){
 try{
  if(!session?.token)throw Error('本地会话尚未建立');
  const r=await fetch('/api/executor/action',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:JSON.stringify({action})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'操作失败');
  drawExecutor(data);
  $('executor-message').textContent='已执行 '+({prepare:'生成任务',start:'开始离线执行',pause:'暂停',resume:'恢复',cancel:'取消'}[action])+'；只处理本地数据';
 }catch(e){$('executor-message').textContent=String(e);}
}
async function wireExecutor(){
 for(const action of ['prepare','start','pause','resume','cancel']){
  $('exec-'+action).onclick=()=>runExecutorAction(action);
 }
 $('exec-refresh').onclick=loadExecutor;
 await loadExecutor();
}
wireExecutor();
setInterval(loadExecutor,3000);
