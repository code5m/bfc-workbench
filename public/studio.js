import {buildStarterTopics} from './topic-recipes.js';
import {validateLibraryState,nextVideo,followingVideo,addToTopic,moveVideo,refreshCategoryTopics} from './library-state.js';
const $=id=>document.getElementById(id),key='self-curated-library-v1';
let data,rows=[],page=1,selected=new Set(),active=null,editing=null,sessionToken=null,syncTimer=null,serverRevision=null,displayMode=localStorage.getItem('bfc-view-mode')||'preview';
let state;try{state=JSON.parse(localStorage.getItem(key))||{topics:[],categories:{},watched:{},last:null};}catch{state={topics:[],categories:{},watched:{},last:null};}
const save=()=>{localStorage.setItem(key,JSON.stringify(state));if(sessionToken){clearTimeout(syncTimer);syncTimer=setTimeout(syncServer,250);}};
async function syncServer(){
 try{
  const response=await fetch('/api/workbench/state',{method:'PUT',headers:{'Content-Type':'application/json','Origin':location.origin,'X-Local-CSRF':sessionToken},body:JSON.stringify({expectedRevision:serverRevision,library:state})});
  if(!response.ok)throw Error('服务端保存失败');
  serverRevision=(await response.clone().json()).summary.revision;
  $('message').dataset.server='已同步服务端';
 }catch(error){$('message').dataset.server=error.message;}
}
const el=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
const category=r=>state.categories[r.bvid]||r.topic;
function option(select,value,label){const o=el('option',label);o.value=value;select.append(o);}
function menus(){if(!state.recipesInitialized){state.topics.unshift(...buildStarterTopics(rows).filter(t=>!state.topics.some(x=>x.id===t.id)));state.recipesInitialized=true;save();}const old=$('filter').value;$('filter').replaceChildren();option($('filter'),'','全部分类');$('assign-category').replaceChildren();for(const c of [...new Set(rows.map(category))].sort()){option($('filter'),c,c);option($('assign-category'),c,c);}$('filter').value=old;$('assign-topic').replaceChildren();for(const t of state.topics)option($('assign-topic'),t.id,t.name);}
function recordOpen(r){state.last=r.bvid;state.lastTopic=active&&state.topics.some(t=>t.id===active&&t.items.includes(r.bvid))?active:null;save();}
function openVideo(r){if(!r)return;recordOpen(r);window.open('https://www.bilibili.com/video/'+encodeURIComponent(r.bvid),'_blank','noopener,noreferrer');if(location.hash.startsWith('#topic/'))detail();}
function video(r,playlistIndex=null){
 const box=el('article','','video video-'+displayMode),check=document.createElement('input');check.type='checkbox';
 check.checked=playlistIndex===null?selected.has(r.bvid):!!state.watched[r.bvid];
 check.setAttribute('aria-label',playlistIndex===null?'选择 '+r.title:'已看完 '+r.title);
 check.onchange=()=>{
  if(playlistIndex===null){check.checked?selected.add(r.bvid):selected.delete(r.bvid);$('selection-count').textContent=`已选 ${selected.size} 条`;}
  else{state.watched[r.bvid]=check.checked;save();detail();}
 };
 box.append(check);if(displayMode==='preview'&&playlistIndex===null){const cover=document.createElement('img');cover.className='video-cover';cover.loading='lazy';cover.alt='';cover.src=r.pic||`https://images.weserv.nl/?url=i0.hdslb.com/bfs/archive/${r.bvid}.jpg`;cover.onerror=()=>{cover.removeAttribute('src');cover.classList.add('cover-fallback');};box.append(cover);}const info=el('div','','info'),a=el('a',r.title);
 a.href='https://www.bilibili.com/video/'+encodeURIComponent(r.bvid);a.target='_blank';a.rel='noopener noreferrer';
 a.onclick=()=>{recordOpen(r);if(playlistIndex!==null)detail();};
 info.append(a,el('small',r.bvid+' · '+category(r)+(r.confidence==='low'?' · 低置信度倾向':'')));
 if(displayMode!=='titles'){const evidence=el('details',''),summary=el('summary','分类依据');evidence.append(summary,el('p',r.reason||'本地分类'));info.append(evidence);}box.append(info);
 if(playlistIndex!==null){
  const t=state.topics.find(x=>x.id===active),chap=document.createElement('select');chap.setAttribute('aria-label','视频章节：'+r.title);
  option(chap,'','未分章节');for(const c of t.chapters)option(chap,c,c);chap.value=t.sections[r.bvid]||'';
  chap.onchange=()=>{t.sections[r.bvid]=chap.value;save();detail();};box.append(chap);
  for(const [name,delta] of [['↑',-1],['↓',1]]){
   const b=el('button',name);b.setAttribute('aria-label',(delta<0?'上移 ':'下移 ')+r.title);
   b.disabled=playlistIndex+delta<0||playlistIndex+delta>=t.items.length;
   b.onclick=()=>{t.customized=true;moveVideo(t,playlistIndex,delta);save();detail();};box.append(b);
  }
  const remove=el('button','移出专题');remove.onclick=()=>{t.customized=true;t.items=t.items.filter(x=>x!==r.bvid);delete t.sections[r.bvid];save();detail();};box.append(remove);
 }else{const b=el('button','观看');b.onclick=()=>openVideo(r);box.append(b);}
 return box;
}
function library(){const q=$('search').value.trim().toLowerCase(),cat=$('filter').value,low=$('confidence').value;const list=rows.filter(r=>(!cat||category(r)===cat)&&(!low||r.confidence===low)&&(!q||(r.title+' '+r.bvid).toLowerCase().includes(q)));const max=Math.max(1,Math.ceil(list.length/40));page=Math.min(page,max);$('videos').dataset.mode=displayMode;$('videos').replaceChildren(...list.slice((page-1)*40,page*40).map(r=>video(r)));$('pages').textContent=`${list.length} 条 · ${page} / ${max} 页`;$('selection-count').textContent=`已选 ${selected.size} 条`;$('prev').disabled=page===1;$('next').disabled=page===max;$('select-page').checked=false;}
function bookshelf(){const fragment=document.createDocumentFragment();for(const t of state.topics){const card=el('article','','card');card.tabIndex=0;card.setAttribute('role','button');card.append(el('small',`${t.items.length} 个视频 · ${t.chapters.length} 个章节`),el('h3',t.name),el('p',t.description));card.onclick=()=>{active=t.id;location.hash='topic/'+t.id;};card.onkeydown=e=>{if(e.key==='Enter')card.click();};fragment.append(card);}$('topics').replaceChildren(fragment);}
function detail(){
 const t=state.topics.find(x=>x.id===active);if(!t){location.hash='topics';return;}
 $('detail-title').textContent=t.name;$('detail-description').textContent=t.description;$('playlist').replaceChildren();if(t.notes)$('playlist').append(el('p','专题笔记：'+t.notes,'topic-notes'));
 const next=nextVideo(t,state.watched);
 const current=t.items.includes(state.last)&&!state.watched[state.last]?state.last:null;
 if(next){
  const start=el('button',current?'继续本节':'观看下一节');start.onclick=()=>openVideo(rows.find(r=>r.bvid===(current||next)));$('playlist').append(start);
  const done=el('button','本节看完，继续下一节');done.disabled=!current;
  done.onclick=()=>{state.watched[current]=true;save();const after=followingVideo(t,current,state.watched);if(after)openVideo(rows.find(r=>r.bvid===after));detail();};$('playlist').append(done);
 }else if(t.items.length)$('playlist').append(el('p','这个专题已全部看完。可取消勾选重新学习。'));
 let chapter=null;
 for(const [i,id] of t.items.entries()){
  const section=t.sections[id]||'未分章节';if(section!==chapter){$('playlist').append(el('h3',section));chapter=section;}
  const r=rows.find(x=>x.bvid===id);if(r)$('playlist').append(video(r,i));
 }
 if(!t.items.length)$('playlist').append(el('p','这个专题还没有视频。从视频库选择后加入。'));
}
function renderResume(container){
 container.replaceChildren();const last=rows.find(r=>r.bvid===state.last);
 if(!last){container.append(el('p','还没有观看记录。从视频库或专题打开视频后，会在这里保留入口。'));return;}
 const box=el('article','','video'),info=el('div','','info');info.append(el('strong',last.title),el('small',state.watched[last.bvid]?'上次打开 · 已标记看完':'上次打开 · 尚未标记看完'));box.append(info);
 const resume=el('button','继续观看');resume.onclick=()=>openVideo(last);box.append(resume);
 const t=state.topics.find(t=>t.id===state.lastTopic);
 if(t){const link=el('a','回到「'+t.name+'」');link.href='#topic/'+t.id;box.append(link);const next=followingVideo(t,last.bvid,state.watched);if(next){const b=el('button','下一节');b.onclick=()=>{active=t.id;openVideo(rows.find(r=>r.bvid===next));};box.append(b);}}
 container.append(box);
}
function setupViewMode(){const toolbar=$('search')?.parentElement;if(!toolbar||$('view-mode'))return;const label=document.createElement('label');label.className='view-mode-label';label.textContent='观看方式';const select=document.createElement('select');select.id='view-mode';select.setAttribute('aria-label','选择观看方式');for(const [value,text] of [['preview','预览卡片'],['list','紧凑列表'],['titles','仅标题']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=displayMode;select.onchange=()=>{displayMode=select.value;localStorage.setItem('bfc-view-mode',displayMode);library();};label.append(select);toolbar.append(label);}
function navigate(){
 if(!data)return;
 const hash=location.hash.slice(1)||'topics';
 const view=hash.startsWith('topic/')?'detail':hash==='classification'?'library':['library','watch'].includes(hash)?hash:'topics';
 for(const name of ['topic','library','detail','watch'])$(name+'-view').hidden=(name==='topic'?'topics':name)!==view;
 for(const link of document.querySelectorAll('nav a')){if(link.getAttribute('href')==='#'+(view==='detail'?'topics':view))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 $('heading').textContent=({topics:'专题书架',library:'全部视频',detail:'专题播放列表',watch:'继续观看'})[view];
 if(view==='topics'){bookshelf();renderResume($('home-continue'));}
 if(view==='library'){setupViewMode();menus();library();}
 if(view==='detail'){active=hash.slice(6);detail();}
 if(view==='watch')renderResume($('continue-list'));
}
function updateOverview(){
 const remaining=rows.filter(r=>category(r)==='综合收藏').length;
 $('message').textContent=`${rows.length} 个视频 · ${state.topics.length} 个专题${remaining?' · '+remaining+' 条待细分':''}`;
}
$('duplicates').onclick=()=>{
 const duplicateVideos=rows.length-new Set(rows.map(r=>r.bvid)).size;
 const duplicateEntries=state.topics.reduce((sum,t)=>sum+t.items.length-new Set(t.items).size,0);
 $('message').textContent=`重复检查：视频库 ${duplicateVideos} 条重复 BV；专题内 ${duplicateEntries} 条重复记录。同一视频可以加入不同专题。`;
};
addEventListener('hashchange',updateOverview);
function edit(t=null){editing=t?.id||null;$('topic-name').value=t?.name||'';$('topic-description').value=t?.description||'';$('topic-notes').value=t?.notes||'';$('topic-chapters').value=(t?.chapters||['入门','进阶','实践']).join('\n');$('topic-dialog').showModal();}
$('new-topic').onclick=()=>edit();$('edit-topic').onclick=()=>edit(state.topics.find(t=>t.id===active));$('close-dialog').onclick=()=>$('topic-dialog').close();$('topic-form').onsubmit=e=>{e.preventDefault();const name=$('topic-name').value.trim();if(!name)return;const t=state.topics.find(t=>t.id===editing)||{id:crypto.randomUUID(),items:[],sections:{}};t.name=name;t.description=$('topic-description').value.trim();t.notes=$('topic-notes').value.trim();t.chapters=[...new Set($('topic-chapters').value.split('\n').map(x=>x.trim()).filter(Boolean))];if(!editing)state.topics.push(t);save();$('topic-dialog').close();navigate();};
$('back').onclick=()=>location.hash='topics';$('find-videos').onclick=()=>{location.hash='library';};for(const id of ['search','filter','confidence'])$(id).oninput=()=>{page=1;library();};$('prev').onclick=()=>{page--;library();};$('next').onclick=()=>{page++;library();};$('select-page').onchange=e=>{for(const c of $('videos').querySelectorAll('input[type=checkbox]')){c.checked=e.target.checked;c.dispatchEvent(new Event('change'));}};
$('add-selected').onclick=()=>{const t=state.topics.find(t=>t.id===$('assign-topic').value);if(!t){edit();return;}const before=t.items.length;if(selected.size)t.customized=true;addToTopic(t,[...selected]);save();$('message').textContent=`已将 ${t.items.length-before} 条新视频加入「${t.name}」，重复项自动跳过`;selected.clear();library();};$('recategorize').onclick=()=>{const c=$('assign-category').value;for(const id of selected)state.categories[id]=c;refreshCategoryTopics(state,rows);save();$('message').textContent=`已修改 ${selected.size} 条视频分类`;selected.clear();menus();library();};
$('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=el('a','');a.href=u;a.download='my-video-library.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
$('logout').onclick=async()=>{if(!sessionToken)return;const response=await fetch('/api/session/logout',{method:'POST',headers:{'X-Local-CSRF':sessionToken}});if(response.ok){sessionToken=null;$('message').textContent='已退出当前会话，专题数据仍保留。';}};
$('import').onchange=async e=>{
 if(!e.target.files.length)return;
 try{
  const restored=validateLibraryState(JSON.parse(await e.target.files[0].text()),new Set(rows.map(r=>r.bvid)));
  localStorage.setItem(key,JSON.stringify(restored));
  state=restored;menus();navigate();$('message').textContent='已恢复备份';
 }catch(err){$('message').textContent=err.message;}
};
addEventListener('hashchange',navigate);
fetch('/api/session').then(r=>r.json()).then(session=>{sessionToken=session.token;return fetch('/api/workbench/state',{headers:{'X-Local-CSRF':sessionToken}})}).then(r=>{
 if(!r.ok)throw Error('服务端视频库暂不可用');
 return r.json();
}).then(x=>{
 data=x;const serverState=x.state;
 rows=Object.values(serverState.videos||{}).map(video=>({...video.raw,...video,
  topic:serverState.library.categories?.[video.bvid]||video.raw?.topic||null,
  confidence:video.raw?.confidence||null,
  reason:video.raw?.reason||'服务端视频主记录'
 }));
 if(!rows.length)throw Error('服务端视频库为空，请先完成数据迁移');
 state=validateLibraryState(state,new Set(rows.map(r=>r.bvid)));
 if(!state.initialized){
  for(const topic of [...new Set(rows.map(category))].filter(t=>!['失效收藏','综合收藏'].includes(t))){
   const items=rows.filter(r=>category(r)===topic).map(r=>r.bvid);
   state.topics.push({id:crypto.randomUUID(),name:topic+' · 收藏精选',description:'按主题整理的收藏。可自行划分章节并调整观看顺序。',chapters:['入门','进阶','实践'],sections:{},items});
  }
  state.initialized=true;save();
 }
 menus();refreshCategoryTopics(state,rows);save();navigate();updateOverview();
 return fetch('/api/workbench/state',{headers:{'X-Local-CSRF':sessionToken}}).then(r=>r.json()).then(server=>{serverRevision=server.summary.revision;return syncServer();});
}).catch(e=>$('message').textContent=e.message);
