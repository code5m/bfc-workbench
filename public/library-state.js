export function validateLibraryState(input,knownIds){
 if(!input||!Array.isArray(input.topics)||!input.categories||Array.isArray(input.categories)||typeof input.categories!=='object'||!input.watched||Array.isArray(input.watched)||typeof input.watched!=='object')throw Error('备份格式不正确');
 const topicIds=new Set();
 const topics=input.topics.map(t=>{
  if(!t||typeof t.id!=='string'||!t.id||topicIds.has(t.id)||typeof t.name!=='string'||!t.name.trim()||!Array.isArray(t.items)||!Array.isArray(t.chapters)||!t.sections||typeof t.sections!=='object'||Array.isArray(t.sections))throw Error('专题数据不正确');
  topicIds.add(t.id);
  if(t.items.some(id=>typeof id!=='string'||!knownIds.has(id))||t.chapters.some(c=>typeof c!=='string'||!c.trim()))throw Error('专题包含未知视频或无效章节');
  const chapters=[...new Set(t.chapters)];
  const sections=Object.fromEntries(Object.entries(t.sections).filter(([id,c])=>t.items.includes(id)&&chapters.includes(c)));
  return {id:t.id,name:t.name.trim(),description:typeof t.description==='string'?t.description:'',notes:typeof t.notes==='string'?t.notes:'',items:[...new Set(t.items)],chapters,sections,...(t.customized?{customized:true}:{})};
 });
 const categories=Object.fromEntries(Object.entries(input.categories).filter(([id,c])=>knownIds.has(id)&&typeof c==='string'&&c.trim()));
 const watched=Object.fromEntries(Object.entries(input.watched).filter(([id,v])=>knownIds.has(id)&&typeof v==='boolean'));
 const notes=Object.fromEntries(Object.entries(input.notes||{}).filter(([id,v])=>knownIds.has(id)&&typeof v==='string').map(([id,v])=>[id,v.slice(0,10000)]));
 const progress=Object.fromEntries(Object.entries(input.progress||{}).filter(([id,v])=>knownIds.has(id)&&v&&typeof v==='object'&&Number.isFinite(v.seconds)&&Number.isFinite(v.duration)&&v.seconds>=0&&v.duration>0).map(([id,v])=>[id,{seconds:Math.min(v.seconds,v.duration),duration:v.duration,source:v.source==='bilibili'?'bilibili':'unknown',updatedAt:typeof v.updatedAt==='string'?v.updatedAt:null}]));
 return {...input,topics,categories,watched,notes,progress,last:knownIds.has(input.last)?input.last:null};
}

export function nextVideo(topic,watched){return topic.items.find(id=>!watched[id])||null;}
export function followingVideo(topic,current,watched){const i=topic.items.indexOf(current);return i<0?nextVideo(topic,watched):topic.items.slice(i+1).find(id=>!watched[id])||null;}
export function addToTopic(topic,ids){topic.items=[...new Set([...topic.items,...ids])];return topic.items;}
export function moveVideo(topic,index,delta){
 const target=index+delta;
 if(index<0||index>=topic.items.length||target<0||target>=topic.items.length)return false;
 [topic.items[index],topic.items[target]]=[topic.items[target],topic.items[index]];return true;
}

export function refreshCategoryTopics(state,rows){
 const description='按主题整理的收藏。可自行划分章节并调整观看顺序。';
 for(const t of state.topics){
  if(t.customized||t.description!==description||!t.name.endsWith(' · 收藏精选')||Object.keys(t.sections).length||t.chapters.join('|')!=='入门|进阶|实践')continue;
  const category=t.name.slice(0,-7);
  if(!rows.some(r=>(state.categories[r.bvid]||r.topic)===category))continue;
  const ids=rows.filter(r=>(state.categories[r.bvid]||r.topic)===category).map(r=>r.bvid);
  if(JSON.stringify(t.items)!==JSON.stringify(ids)){
   state.generatedTopicBackups||={};
   state.generatedTopicBackups[t.id]||=[...t.items];
   t.items=ids;
  }
 }
}
