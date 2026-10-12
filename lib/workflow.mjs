// Offline planning only. No Bilibili API calls or account writes.
export const TARGETS=Object.freeze({
 '英语':'英语','体育':'体育','AI':'ai','编程':'编程','电影创作':'电影创作',
 '音乐':'音乐','职场':'工作','健身健康':'健身饮食','数学':'数学',
 '心理情感':'心理情感','生活':'生活','游戏电竞':'王者荣耀操作设置',
 '写作小说':'写作小说等','自媒体':'自媒体','财经商业':'财经商业',
 '学习方法':'学习经验','科普知识':'新奇','摄影设计':'摄影设计','历史社会':'历史社会'
});
export const validTopic=(s)=>Object.hasOwn(TARGETS,s);
const validBvid=(s)=>typeof s==='string' && /^BV[0-9a-zA-Z]{8,20}$/.test(s);
const title=(s)=>String(s||'').trim().slice(0,160);
const invalidTitle=(s)=>!s || s==='已失效视频';
export function deriveWorkflow({inventory,classification,description,overrides,assistant,guard,copySummary}={}){
 const items=new Map(), folders=inventory?.folder_status||[], statuses=new Map(folders.map(x=>[x.title,x]));
 const folderIds=new Set((inventory?.folders||[]).map(x=>x.title));
 for(const row of inventory?.members||[]){
  if(!validBvid(row?.bvid))continue;
  let x=items.get(row.bvid);
  if(!x){x={bvid:row.bvid,title:title(row.title),sources:[],categories:new Set(),suggestion:null,topic:null};items.set(row.bvid,x);}
  if(invalidTitle(x.title)&&!invalidTitle(title(row.title)))x.title=title(row.title);
  if(!x.sources.some(s=>s.folderId===row.folder_id))x.sources.push({folderId:row.folder_id,folderName:String(row.folder_title||'')});
 }
 for(const [topic,rows] of Object.entries(classification?.categories||{})){
  if(!validTopic(topic))continue;
  for(const row of rows){const x=items.get(row.bvid);if(x)x.categories.add(topic);}
 }
 for(const row of description?.decisions||[]){
  const x=items.get(row.bvid);
  if(x&&row.status==='review_suggested'&&validTopic(row.candidate)&&!x.suggestion)x.suggestion=row.candidate;
 }
 const stats={
  memberships:(inventory?.members||[]).length,unique:items.size,
  classified:0,manual:0,assistantReviewed:0,conflict:0,unclassified:0,invalid:0,descriptionReview:0,
  preexisting:0,needsLiveVerify:0,needsTargetCreate:0,
  historicalCopied:Object.values(copySummary?.copied||{}).reduce((a,b)=>a+Number(b||0),0),
  phase2Verified:0,readyToWrite:0,scanComplete:inventory?.complete===true,
  completeFolders:folders.filter(x=>x.exhausted===true).length,totalFolders:folders.length,
  topics:{},syncStates:{},reviewStates:{}
 };
 const videos=[];
 for(const x of items.values()){
  const manual=overrides?.decisions?.[x.bvid];const assisted=assistant?.decisions?.[x.bvid];const topics=[...x.categories];
  if(invalidTitle(x.title)){x.decision='invalid';stats.invalid++;}
  else if(manual && validTopic(manual.topic)){x.topic=manual.topic;x.decision='local_approved';stats.manual++;}
  else if(assisted && validTopic(assisted.topic) && assisted.title===x.title && assisted.origin==='assistant_local_metadata_review' && assisted.humanApproved===false){x.topic=assisted.topic;x.decision='assistant_reviewed';stats.assistantReviewed++;}
  else if(topics.length>1){x.decision='conflict';stats.conflict++;}
  else if(topics.length===1){x.topic=topics[0];x.decision='suggested';stats.classified++;}
  else if(x.suggestion){x.decision='description_review';stats.descriptionReview++;}
  else{x.decision='unclassified';stats.unclassified++;}
  if(x.topic){
   x.targetFolder=TARGETS[x.topic];
   const dst=statuses.get(x.targetFolder);
   if(x.sources.some(s=>s.folderName===x.targetFolder)){x.syncState='exists_in_target_snapshot';stats.preexisting++;}
   else if(!dst||!folderIds.has(x.targetFolder)){x.syncState='target_folder_missing';stats.needsTargetCreate++;}
   else {x.syncState=dst.exhausted?'requires_fresh_target_verification':'target_scan_incomplete';stats.needsLiveVerify++;}
   stats.topics[x.topic]=(stats.topics[x.topic]||0)+1;
  }else x.syncState=x.decision==='invalid'?'invalid':'needs_review';
  stats.syncStates[x.syncState]=(stats.syncStates[x.syncState]||0)+1;
  stats.reviewStates[x.decision]=(stats.reviewStates[x.decision]||0)+1;
  videos.push({bvid:x.bvid,title:x.title,sources:x.sources,topic:x.topic,candidateTopics:topics,
    suggestion:x.suggestion,decision:x.decision,targetFolder:x.targetFolder||null,syncState:x.syncState,
    url:'https://www.bilibili.com/video/'+x.bvid});
 }
 const order=['conflict','description_review','unclassified','assistant_reviewed','suggested','local_approved','invalid'];
 videos.sort((a,b)=>order.indexOf(a.decision)-order.indexOf(b.decision)||a.title.localeCompare(b.title,'zh-CN'));
 const blocked=guard?.status==='blocked';
 return {
  generatedAt:new Date().toISOString(),blocked,reason:blocked?String(guard?.reason||'platform_access_refused'):'none',
  phase2WriteEnabled:false,stats,videos,
  folders:folders.map(x=>({title:String(x.title||''),read:Number(x.retrieved||0),reported:Number(x.reported||0),
   nextPage:Number(x.last_page||1),exhausted:x.exhausted===true,lastError:String(x.last_error||'')})),
  milestones:[
   {id:'snapshot',label:'保存本地收藏数据',status:stats.memberships?'completed':'pending'},
   {id:'classify',label:'唯一 BV 视频分类与冲突检查',status:'in_progress'},
   {id:'review',label:'未分类和类别冲突复核',status:stats.conflict+stats.unclassified+stats.descriptionReview?'in_progress':'completed'},
   {id:'scan',label:'读取全部可见收藏夹',status:stats.scanComplete?'completed':blocked?'blocked':'pending'},
   {id:'live_verify',label:'目标收藏夹实时去重核对',status:blocked?'blocked':'pending'},
   {id:'phase2',label:'第二轮账号写入并回读',status:blocked?'blocked':'pending'},
   {id:'final_audit',label:'最终验收与无遗漏审计',status:'pending'},
  ]
 };
}
export function pageVideos(workflow,{q='',state='review',topic='',page=1,limit=20}={}){
 let records=workflow.videos;const query=String(q).slice(0,100).trim().toLocaleLowerCase('zh-CN');
 if(query)records=records.filter(x=>x.title.toLocaleLowerCase('zh-CN').includes(query)||x.bvid.toLowerCase().includes(query));
 if(topic && validTopic(topic))records=records.filter(x=>x.topic===topic||x.suggestion===topic||x.candidateTopics.includes(topic));
 if(state==='review')records=records.filter(x=>['conflict','unclassified','description_review'].includes(x.decision));
 else if(state==='classified')records=records.filter(x=>['suggested','assistant_reviewed','local_approved'].includes(x.decision));
 else if(state==='assisted')records=records.filter(x=>x.decision==='assistant_reviewed');
 else if(state==='invalid')records=records.filter(x=>x.decision==='invalid');
 const n=Math.max(1,Math.min(100,Math.trunc(Number(limit)||20)));const p=Math.max(1,Math.min(1e6,Math.trunc(Number(page)||1)));
 return {count:records.length,page:p,limit:n,items:records.slice((p-1)*n,p*n)};
}
