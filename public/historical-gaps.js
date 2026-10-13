// Local-only Bilibili sync readiness and historical archive review.
// Never calls Bilibili or changes access guard.
(function(){
 const $=id=>document.getElementById(id);
 let page=1;
 const make=(parent,tag,value,cls)=>{
  const el=document.createElement(tag);
  if(value!==undefined)el.textContent=String(value);
  if(cls)el.className=cls;
  parent.append(el);
  return el;
 };
 async function refreshReadiness(){
  const status=await (await fetch('/api/status',{cache:'no-store'})).json();
  const blocked=Boolean(status.access?.blocked);
  $('recovery-guard').textContent=blocked?'已熔断（历史412）':'未熔断（仍需授权）';
  $('recovery-folders').textContent=status.folders?.filter(f=>!f.complete).length??'未知';
  $('recovery-verified').textContent=String(status.sync?.phase2Verified??0);
  $('recovery-writes').textContent=status.accountMutationsEnabled?'开启':'禁用';
  $('recovery-state').textContent=blocked?'当前不能采集或同步':'仍未通过实时验证';
  $('recovery-state').className='completion-state unmet';
  $('recovery-detail').textContent=blocked?
   '历史阻塞原因：'+(status.access?.reason||'未知')+'。这不是新一次网络请求的结果。网页登录后仍需确认收藏接口是否被允许访问。':
   '没有自动启用账号写入；需获得有效的访问与回读证据。';
 }
 async function refreshHistoricalMeta(){
  const response=await fetch('/api/historical-gaps',{cache:'no-store'});
  if(!response.ok)throw Error('历史资料未能读取');
  const result=await response.json();
  const info=result.totals||{};
  $('historical-gap-summary').textContent=(info.archivedOnly??0)+' 条待核对 · '+(info.titlesAvailable??0)+' 条有标题';
  const folder=$('historical-gap-folder'),previous=folder.value;
  folder.replaceChildren();
  const none=make(folder,'option','全部历史目录');none.value='';
  for(const [name,count] of Object.entries(result.folders||{})){
   const option=make(folder,'option',name+'（'+count+'）');option.value=name;
  }
  folder.value=previous;
 }
 async function refreshHistoricalItems(){
  const query=new URLSearchParams({page,folder:$('historical-gap-folder').value});
  const response=await fetch('/api/historical-gaps/items?'+query,{cache:'no-store'});
  if(!response.ok)throw Error('历史明细读取失败');
  const result=await response.json();
  const out=$('historical-gap-items');out.replaceChildren();
  for(const item of result.items||[]){
   const row=make(out,'div',undefined,'review-item');
   const body=make(row,'div',undefined,'review-main');
   const link=make(body,'a',item.title||item.bvid,'review-title');
   link.href='https://www.bilibili.com/video/'+item.bvid;
   link.rel='noopener noreferrer';link.target='_blank';
   make(body,'small','BV号：'+item.bvid+' · 旧目录：'+item.originalFolders.join('、'));
   make(body,'small',item.classificationHint?
     '仅供参考的分类线索：'+item.classificationHint+' · 尚未回读确认':
     '缺少明确主题 · 当前收藏状态未核实');
   make(row,'span','待回读','folder-state warn');
  }
  $('historical-gap-page').textContent='共 '+result.total+' 条 · 第 '+result.page+' 页';
  $('historical-gap-prev').disabled=page<=1;
  $('historical-gap-next').disabled=page*25>=result.total;
 }
 async function initialize(){
  try{
   await Promise.all([refreshReadiness(),refreshHistoricalMeta()]);
   await refreshHistoricalItems();
  }catch(e){$('historical-gap-message').textContent='读取失败：'+String(e);}
 }
 $('historical-gap-folder').onchange=()=>{page=1;refreshHistoricalItems().catch(e=>$('historical-gap-message').textContent=String(e));};
 $('historical-gap-prev').onclick=()=>{page=Math.max(1,page-1);refreshHistoricalItems().catch(e=>$('historical-gap-message').textContent=String(e));};
 $('historical-gap-next').onclick=()=>{page++;refreshHistoricalItems().catch(e=>$('historical-gap-message').textContent=String(e));};
 initialize();
})();
