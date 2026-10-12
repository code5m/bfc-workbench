let evidencePage=1;
async function evidenceLoad(){
 try{
  const meta=await (await fetch('/api/evidence')).json();
  if(!meta.ready){$('evidence-summary').textContent='尚未生成证据文件';return;}
  const m=meta.summary;
  $('evidence-summary').textContent='原待复核 '+m.originalReview+' · 新增仅供确认的明确标题建议 '+m.titleSpecific+' · 仍需人工判断 '+m.needsHumanReview+' · 默认夹优先 '+m.titleEvidenceDefault;
  const d=await (await fetch('/api/evidence/items?page='+evidencePage)).json();
  const box=$('evidence-list');box.replaceChildren();
  for(const item of d.items){
   const line=elem(box,'div',undefined,'review-item');
   const left=elem(line,'div',undefined,'review-main');
   const link=elem(left,'a',item.bvid,'review-title');
   link.href='https://www.bilibili.com/video/'+item.bvid;link.target='_blank';link.rel='noopener noreferrer';
   elem(left,'small','推荐：'+item.topic+' · 标题证据：'+(item.titleSignals[item.topic]||[]).join('、')+' · '+(item.defaultSource?'默认收藏夹':'其他收藏夹'));
   elem(line,'span','需人工确认','folder-state warn');
  }
  $('evidence-total').textContent='共 '+d.total+' 条高证据建议，第 '+d.page+' 页';
  $('evidence-prev').disabled=evidencePage<=1;$('evidence-next').disabled=evidencePage*30>=d.total;
 }catch(e){$('evidence-message').textContent=String(e);}
}
$('evidence-refresh').onclick=async()=>{
 try{
  const session=await (await fetch('/api/session')).json();
  const r=await fetch('/api/evidence/rebuild',{method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},body:'{}'});
  if(!r.ok)throw Error('请求失败 '+r.status);
  evidencePage=1;await evidenceLoad();$('evidence-message').textContent='已离线检查，B站请求 0 次';
 }catch(e){$('evidence-message').textContent=String(e);}
};
$('evidence-prev').onclick=()=>{evidencePage=Math.max(1,evidencePage-1);evidenceLoad();};
$('evidence-next').onclick=()=>{evidencePage++;evidenceLoad();};
evidenceLoad();
