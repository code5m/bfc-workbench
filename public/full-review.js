let fullReviewPage=1;
async function fullReviewLoad(){
 try{
  const r=await fetch('/api/complete-local-review');if(!r.ok)throw Error('读取失败');
  const d=await r.json();if(!d.ready)throw Error('尚未生成离线复核');
  const x=d.stats;
  document.getElementById('full-review-stats').textContent='逐条检查 '+x.reviewed+'/'+x.total+'，有主题线索 '+x.topicHints+'，仍无可靠分类 '+x.unresolved+'，失效视频 '+x.invalidOriginal+'（其中简介可用 '+x.invalidWithUsableIntro+'）';
  const state=document.getElementById('full-review-state').value;
  const invalid=document.getElementById('full-review-invalid').checked?'1':'0';
  const q=new URLSearchParams({state,invalid,page:fullReviewPage});
  const res=await fetch('/api/complete-local-review/items?'+q);
  if(!res.ok)throw Error('明细读取失败');
  const data=await res.json(),out=document.getElementById('full-review-list');out.replaceChildren();
  for(const v of data.items){
   const row=document.createElement('div');row.className='review-item';
   const left=document.createElement('div');left.className='review-main';
   const a=document.createElement('a');a.href='https://www.bilibili.com/video/'+v.bvid;a.textContent=v.bvid;a.target='_blank';a.rel='noopener noreferrer';left.append(a);
   for(const s of ['原状态：'+v.originalDecision+' · 建议：'+(v.topicHint||'信息不足'),v.basis+' · '+v.status]){
    const small=document.createElement('small');small.textContent=s;left.append(small);
   }
   row.append(left);out.append(row);
  }
  document.getElementById('full-review-count').textContent=data.total+' 条 · 第 '+data.page+' 页';
  document.getElementById('full-review-prev').disabled=fullReviewPage===1;
  document.getElementById('full-review-next').disabled=fullReviewPage*30>=data.total;
 }catch(e){document.getElementById('full-review-message').textContent=String(e);}
}
for(const id of ['full-review-state','full-review-invalid']){
 document.getElementById(id).onchange=()=>{fullReviewPage=1;fullReviewLoad();};
}
document.getElementById('full-review-prev').onclick=()=>{fullReviewPage=Math.max(1,fullReviewPage-1);fullReviewLoad();};
document.getElementById('full-review-next').onclick=()=>{fullReviewPage++;fullReviewLoad();};
document.getElementById('full-review-refresh').onclick=async()=>{
 try{
  const session=await (await fetch('/api/session')).json();
  const r=await fetch('/api/complete-local-review/rebuild',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:'{}'});
  if(!r.ok)throw Error('更新失败 '+r.status);
  fullReviewPage=1;await fullReviewLoad();
  document.getElementById('full-review-message').textContent='仅离线核对；没有访问或修改B站账号';
 }catch(e){document.getElementById('full-review-message').textContent=String(e);}
};
fullReviewLoad();