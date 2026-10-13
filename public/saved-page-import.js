import {extractSavedHtmlVideos,extractSavedJsonVideos} from './saved-page-parser.js';
// Save-only browser import: parses user-selected files without contacting Bilibili.
// Only a limited, explicit list of BV IDs/titles is sent to the local workbench.
(function(){
 const byId=id=>document.getElementById(id);
 const bvidPattern=/^BV[0-9A-Za-z]{10}$/;
 const clean=(s,max=240)=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
 let preview=null;
 function updatePreview(message,items=[]){
  byId('saved-page-import-preview').textContent=message;
  const out=byId('saved-page-import-items');out.replaceChildren();
  for(const row of items.slice(0,12)){
   const line=document.createElement('div');line.className='audit-line';
   line.textContent=row.title+' · '+row.bvid;out.append(line);
  }
 }
 async function loadReport(){
  const data=await (await fetch('/api/saved-page-import',{cache:'no-store'})).json();
  byId('saved-page-import-total').textContent=String(data.stagedUnique);
  byId('saved-page-import-new').textContent=String(data.notInSnapshot);
  byId('saved-page-import-pages').textContent=String(data.savedPages);
  byId('saved-page-import-count').textContent=data.stagedUnique+' 条待核对';
 }
 async function initialize(){
  try{
   const state=await (await fetch('/api/status',{cache:'no-store'})).json();
   byId('saved-page-import-sync').textContent=String(state.sync?.phase2Verified??0);
   const select=byId('saved-page-import-folder');
   for(const folder of state.folders||[]){
    const opt=document.createElement('option');opt.textContent=folder.name;opt.value=folder.name;select.append(opt);
   }
   await loadReport();
  }catch(error){byId('saved-page-import-message').textContent='加载失败：'+String(error);}
 }
 byId('saved-page-import-file').addEventListener('change',async()=>{
  const file=byId('saved-page-import-file').files?.[0];
  preview=null;byId('saved-page-import-save').disabled=true;
  if(!file)return;
  if(file.size>10*1024*1024){
   updatePreview('文件超过10MB，未读取。请仅保存所需收藏夹网页或使用较小文件。');return;
  }
  const ext=file.name.toLowerCase().split('.').pop();
  if(!['html','htm','json'].includes(ext)){updatePreview('只支持 HTML 或 JSON 文件。');return;}
  try{
   const body=await file.text();
   const format=ext==='json'?'saved_json':'saved_html';
   const entries=format==='saved_json'?extractSavedJsonVideos(body):extractSavedHtmlVideos(body);
   if(entries.length>200){
    updatePreview('文件中超过200个不同 BV 号。为防止遗漏，没有截断导入。请将数据拆分为每批不超过200条。');
    return;
   }
   if(entries.length===0){
    updatePreview('没有找到 BV 号。请在 B站收藏夹完整加载后保存页面，或选择已有的收藏 JSON。');
    return;
   }
   preview={entries,format,sourceName:file.name};
   byId('saved-page-import-save').disabled=!byId('saved-page-import-folder').value;
   updatePreview('从本地文件提取 '+entries.length+' 个不同 BV 号，下面最多预览12条。仅覆盖该文件包含的内容，不代表整个收藏夹已采集。',entries);
  }catch(error){updatePreview('解析失败：'+String(error));}
 });
 byId('saved-page-import-folder').addEventListener('change',()=>{
  byId('saved-page-import-save').disabled=!preview||!byId('saved-page-import-folder').value;
 });
 byId('saved-page-import-save').addEventListener('click',async()=>{
  if(!preview||!byId('saved-page-import-folder').value)return;
  const button=byId('saved-page-import-save');button.disabled=true;
  try{
   const session=await (await fetch('/api/session')).json();
   const resp=await fetch('/api/saved-page-import',{
    method:'POST',headers:{'Content-Type':'application/json','X-Local-CSRF':session.token},
    body:JSON.stringify({...preview,folder:byId('saved-page-import-folder').value})
   });
   const result=await resp.json();
   if(!resp.ok)throw Error(result.error||'无法导入');
   byId('saved-page-import-message').textContent=result.alreadyImported?
    '这份网页内容已经暂存过，不会重复计数。':
    '已本地暂存 '+result.submittedEntries+' 条候选，其中新加入的 BV '+result.importedNewBvids+' 个。尚未同步 B站。';
   await loadReport();
  }catch(error){byId('saved-page-import-message').textContent='导入失败：'+String(error);}
  finally{button.disabled=false;}
 });
 initialize();
})();
