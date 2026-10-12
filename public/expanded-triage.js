let expandedPage=1;
async function loadExpanded(){
 try{
  const metaResp=await fetch('/api/expanded-triage');
  if(!metaResp.ok)throw Error('无法读取扩展复核结果');
  const d=await metaResp.json(),s=d.stats;
  document.getElementById('expanded-summary').textContent='743 条复核 · 新增标题候选 '+s.provisionalTitleHints+' · 失效简介候选 '+s.invalidDescriptionHints+' · 仍无法判断 '+s.unresolved;
  const state=document.getElementById('expanded-state').value;
  const r=await fetch('/api/expanded-triage/items?'+new URLSearchParams({state,page:expandedPage}));
  if(!r.ok)throw Error('分页结果不可用');
  const data=await r.json(),list=document.getElementById('expanded-list');list.replaceChildren();
  for(const item of data.items){
   const entry=document.createElement('div');entry.className='review-item';
   const details=document.createElement('div');details.className='review-main';
   const link=document.createElement('a');link.className='review-title';
   link.href='https://www.bilibili.com/video/'+item.bvid;link.textContent=item.originalTitle||item.bvid;link.target='_blank';link.rel='noopener noreferrer';details.append(link);
   for(const line of ['待复核候选：'+(item.expanded.topic||'无法判定'),item.expanded.reason+' · '+item.expanded.status]){
    const text=document.createElement('small');text.textContent=line;details.append(text);
   }
   entry.append(details);list.append(entry);
  }
  document.getElementById('expanded-page').textContent='第 '+expandedPage+' 页 · '+data.total+' 条';
  document.getElementById('expanded-prev').disabled=expandedPage===1;
  document.getElementById('expanded-next').disabled=expandedPage*25>=data.total;
 }catch(e){document.getElementById('expanded-message').textContent=String(e);}
}
document.getElementById('expanded-state').onchange=()=>{expandedPage=1;loadExpanded();};
document.getElementById('expanded-prev').onclick=()=>{expandedPage=Math.max(1,expandedPage-1);loadExpanded();};
document.getElementById('expanded-next').onclick=()=>{expandedPage++;loadExpanded();};
loadExpanded();
