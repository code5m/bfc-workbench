const $=id=>document.getElementById(id);
let session=null,currentPage=1,currentState='review',currentQuery='';
const format=n=>new Intl.NumberFormat('zh-CN').format(n??0);
function elem(parent,tag,value,cls){const el=document.createElement(tag);if(value!==undefined)el.textContent=String(value);if(cls)el.className=cls;parent.append(el);return el;}
function drawStatus(d){
 const blocked=d.access.blocked;
 $('access').textContent=blocked?'访问状态：HTTP 412 安全暂停':'访问状态：仅本地分析';
 $('access').className=blocked?'pill blocked':'pill';
 $('headline').textContent=blocked?'平台访问已暂停，本地整理正常进行':'本地分类工作台运行正常';
 $('subhead').textContent=blocked?'B站接口熔断生效。可以离线复核分类，但无法同步账号。':'页面仅使用本机数据。';
 $('memberships').textContent=format(d.snapshot.memberships);
 $('unique').textContent=format(d.snapshot.distinctBvids);
 $('classified').textContent=format(d.workflow.stats.classified+d.workflow.stats.manual);
 $('copied').textContent=format(d.sync.historicalCopies);
 $('coverage').textContent=d.snapshot.memberships?Math.round(100*(d.workflow.stats.classified+d.workflow.stats.manual)/d.snapshot.distinctBvids)+'%':'—';
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
 $('updated').textContent='最近刷新：'+new Date().toLocaleString('zh-CN');
}
async function refresh(){
 try{
  const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  drawStatus(await r.json());
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
refresh();bootstrap();setInterval(refresh,30000);
