
let libraryPage=1,libraryTotal=0;
async function loadLibraryMeta(){
 const r=await fetch('/api/local-catalog');if(!r.ok)throw Error('本地目录概况不可读取');
 const meta=await r.json();
 $('library-stats').textContent=meta.totals.distinctBvids+' 个视频 · '+meta.categories.length+' 个主题 · '+meta.totals.assistedClassifications+' 已AI复核 · '+meta.totals.needingReview+' 待复核 · '+meta.totals.unobservedFolders+' 个目录待补采';
 const chooser=$('library-category'),old=chooser.value;chooser.replaceChildren();
 const all=elem(chooser,'option','全部主题');all.value='';
 for(const c of meta.categories){const opt=elem(chooser,'option',c.name+' ('+c.count+')');opt.value=c.name;}
 chooser.value=old;
 const nav=$('library-topic-nav');
 nav.replaceChildren();
 for(const [topic,label,count] of [['','全部主题',meta.totals.distinctBvids],...meta.categories.map(c=>[c.name,c.name,c.count])]){
  const btn=elem(nav,'button',undefined,'library-topic-button');
  btn.type='button';btn.setAttribute('aria-pressed',String(chooser.value===topic));
  elem(btn,'span',label);elem(btn,'span',count,'count');
  btn.onclick=()=>{chooser.value=topic;libraryPage=1;loadLibrary();refreshTopicSelection();};
 }

}
function refreshTopicSelection(){
 const current=$('library-category').value;
 for(const btn of $('library-topic-nav').querySelectorAll('button')){
  btn.setAttribute('aria-pressed',String(btn.querySelector('span')?.textContent===(current||'全部主题')));
 }
}
async function loadLibrary(){
 try{
  const params=new URLSearchParams({category:$('library-category').value,state:$('library-state').value,
    q:$('library-search').value,page:libraryPage});
  const r=await fetch('/api/local-catalog/items?'+params);if(!r.ok)throw Error('数据读取失败');
  const data=await r.json(),out=$('library-items');out.replaceChildren();libraryTotal=data.total;
  for(const v of data.items){
   const line=elem(out,'div',undefined,'review-item'),left=elem(line,'div',undefined,'review-main');
   const a=elem(left,'a',v.title||v.bvid,'review-title');a.href=v.url;a.target='_blank';a.rel='noopener noreferrer';
   elem(left,'small','分类：'+(v.topic||'待复核')+' · 状态：'+v.localReviewState);
   elem(left,'small','来自：'+v.sources.map(x=>x.folderName).join('、'));
   elem(line,'span',v.defaultSource?'默认夹优先':'已有其他来源','folder-state '+(v.defaultSource?'warn':'ok'));
  }
  $('library-page-stats').textContent='共 '+data.total+' 个视频 · 第 '+libraryPage+' 页';
  $('library-prev').disabled=libraryPage<=1;$('library-next').disabled=libraryPage*25>=data.total;
 }catch(e){$('library-message').textContent=String(e);}
}
async function bootLibrary(){
 try{await loadLibraryMeta();await loadLibrary();}catch(e){$('library-message').textContent=String(e);}
 $('library-category').onchange=()=>{libraryPage=1;loadLibrary();refreshTopicSelection();};
 $('library-state').onchange=()=>{libraryPage=1;loadLibrary();};
 $('library-search').oninput=()=>{libraryPage=1;loadLibrary();};
 $('library-prev').onclick=()=>{libraryPage=Math.max(1,libraryPage-1);loadLibrary();};
 $('library-next').onclick=()=>{libraryPage++;loadLibrary();};
 $('library-refresh').onclick=async()=>{
  try{
   const session=await (await fetch('/api/session')).json();
   const r=await fetch('/api/local-catalog/rebuild',{method:'POST',headers:{
    'Content-Type':'application/json','Origin':location.origin,'X-Local-CSRF':session.token},body:'{}'});
   if(!r.ok)throw Error('重建失败 '+r.status);
   await loadLibraryMeta();await loadLibrary();$('library-message').textContent='本地目录已重建，没有访问 B站。';
  }catch(e){$('library-message').textContent=String(e);}
 };
}
bootLibrary();
