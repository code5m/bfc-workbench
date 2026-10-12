(function(){
 const valid=new Set(['overview','classification','sync']);
 function navigate(){
  const requested=location.hash.slice(1);
  const view=valid.has(requested)?requested:'overview';
  document.body.dataset.activeView=view;
  for(const a of document.querySelectorAll('[data-view-link]')){
   const selected=a.dataset.viewLink===view;
   if(selected)a.setAttribute('aria-current','page');
   else a.removeAttribute('aria-current');
  }
  if(!valid.has(requested))history.replaceState(null,'','#'+view);
  document.title=({overview:'总览',classification:'分类管理',sync:'同步管理'}[view])+' · B站收藏夹整理工作台';
 }
 addEventListener('hashchange',navigate);
 navigate();
})();
