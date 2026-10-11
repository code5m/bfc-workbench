const $=x=>document.getElementById(x);
const fmt=n=>new Intl.NumberFormat('zh-CN').format(n ?? 0);
function tag(node,tagName,text,className=''){const e=document.createElement(tagName);e.textContent=text;if(className)e.className=className;node.append(e);return e;}
function draw(d){
 const blocked=d.access.blocked;
 $('access').textContent=blocked?'访问状态：HTTP 412 安全暂停':'访问状态：仅本地分析';
 $('access').className=blocked?'pill blocked':'pill';
 $('headline').textContent=blocked?'平台访问已暂停，本地整理正常进行':'本地分类工作台运行正常';
 $('subhead').textContent=blocked?'保护策略正在生效：禁止自动继续读取或写入 B站。':'此页面不访问 B站，仅展示本机现有数据。';
 $('memberships').textContent=fmt(d.snapshot.memberships);
 $('unique').textContent=fmt(d.snapshot.distinctBvids);
 $('classified').textContent=fmt(d.classification.categorized);
 $('copied').textContent=fmt(d.sync.historicalCopies);
 const pct=d.snapshot.memberships?Math.round(100*d.classification.categorized/d.snapshot.memberships):0;
 $('coverage').textContent=pct+'%';
 const topics=$('topics');topics.replaceChildren();
 const max=Math.max(1,...Object.values(d.classification.byTopic));
 Object.entries(d.classification.byTopic).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
  const wrap=tag(topics,'div','', 'topic');
  const label=tag(wrap,'div','', 'topic-label');tag(label,'span',name);tag(label,'b',fmt(count));
  const track=tag(wrap,'div','', 'track');const fill=tag(track,'div','', 'fill');fill.style.width=(count/max*100)+'%';
 });
 const acts=$('actions');acts.replaceChildren();
 d.actionQueue.forEach((item,i)=>{const row=tag(acts,'div','', 'action');tag(row,'span',String(i+1).padStart(2,'0'),'step');const detail=tag(row,'div','', 'action-body');tag(detail,'b',item.title);tag(detail,'small',item.detail);tag(row,'span',item.status==='blocked'?'阻塞':item.status==='done'?'完成':item.status==='working'?'进行中':'待处理',item.status==='blocked'?'state blocked':'state');});
 const folders=$('folders');folders.replaceChildren();
 d.folders.forEach(f=>{const row=tag(folders,'div','', 'folder');const label=tag(row,'div','', 'folder-label');tag(label,'b',f.name);tag(label,'span',f.complete?'已遍历':'待续扫','folder-state '+(f.complete?'ok':'warn')); const reported=f.reported || 0;const percent=reported?Math.min(100,Math.round(f.read/reported*100)):(f.complete?100:0); const meta=tag(row,'div','', 'folder-meta');tag(meta,'span',fmt(f.read)+' 条已读');tag(meta,'span',f.complete?'已结束':f.lastError?'受阻：'+f.lastError:'下一页：'+f.nextPage);const track=tag(row,'div','', 'track');const fill=tag(track,'div','', 'fill '+(f.complete?'green':''));fill.style.width=percent+'%';});
 $('coverage-label').textContent=d.folders.filter(f=>f.complete).length+'/'+d.folders.length+' 个文件夹完成遍历';
 $('updated').textContent='最近刷新：'+new Date().toLocaleString('zh-CN');
}
async function refresh(){try{const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);draw(await response.json());}catch(e){$('headline').textContent='本地状态读取失败';$('subhead').textContent=String(e);}}
refresh();setInterval(refresh,30000);
