import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';

// Offline lexical evidence. All rules must be specific to a subject. Generic
// "AI", "video", "skill" and "system" alone are not sufficient for auto-proposal.
// Multiple title topics, existing classification conflicts and contradictory
// description hints must remain human review.
export const RULE_VERSION = 1;
export const FILE_NAME = 'local-evidence-proposals.json';
const TERMS = Object.freeze({
 'AI': [
  'ChatGPT','Claude','Gemini','DeepSeek','Codex','OpenAI','OpenClaw','MCP',
  'LLM','AIGC','智能体','大模型','机器学习','提示词','模型微调','模型推理',
  'RAG','AI工具','AI助手','AI模型','AI编程','AI应用'
 ],
 '编程': [
  'GitHub','GitLab','Python','JavaScript','TypeScript','Rust','React',
  'Vue','Docker','Linux','MySQL','SQL','Tauri','VSCode','程序员',
  '代码','源码','编程','前端','后端','数据库','微服务','代码库','接口开发',
  '开源框架','软件开发','开源项目','程序设计','程序开发'
 ],
 '电影创作': [
  'Blender','Seedance','ComfyUI','分镜','运镜','一镜到底','电影镜头',
  '电影创作','电影制作','视频创作','视频生成','视频制作','视频剪辑',
  '动画模板','动画制作','3D建模','剪辑教程','视频特效','影视特效',
  'AI短片','AI漫剧','AI短剧','影视级','电影感','短剧制作','AI生视频',
  'AI生成视频','AI做视频','做成视频','电影配音','视频模板'
 ],
 '英语': ['英语','英文','美音','英音','雅思','托福','PTE','音标','英语连读',
  '口语连读','英语发音','英语听力','英语口语','English','IELTS','TOEFL'],
 '体育': ['篮球','足球','男篮','女篮','投篮','运球','三威胁','NBA','CBA',
  '世界杯','欧冠','后撤步','乒乓球','羽毛球','网球','国足','英超','西甲'],
 '音乐': ['音乐','吉他','钢琴','声乐','乐理','编曲','唱歌','作曲','演唱'],
 '数学': ['数学','微积分','线性代数','三角函数','概率论','数学方程','几何题'],
 '健身健康': ['健身','拉伸','减脂','增肌','肩颈','膝盖','医学科普','营养素',
  '体态矫正','力量训练','康复训练','训练动作','健美'],
 '职场': ['职场','面试','简历','求职','招聘','涨薪','跳槽','入职','离职',
  '加班','薪资','办公室政治','远程工作','绩效考核','升职加薪'],
 '生活': ['旅行攻略','旅游攻略','旅行','旅游','租房','做饭','烹饪','收纳','育儿',
  '家居','生活技巧','打工度假','新西兰签证','澳洲签证'],
 '心理情感': ['心理学','人格','情感','婚恋','恋爱','恋情','婚姻','社交恐惧',
  '两性关系','男女关系','情绪管理','精神内耗','人情世故','心理技巧','自卑'],
 '自媒体': ['自媒体','小红书','视频号运营','账号运营','内容运营','涨粉',
  '粉丝增长','直播带货','短视频运营','MCN','账号变现'],
 '写作小说': ['小说','网文','写作','剧本写作','作文','修辞','比喻','诗歌','文学'],
 '财经商业': ['股票','股市','基金','财报','商业模式','财务报表','投资组合',
  '量价','通胀','融资','A股','港股','外贸开发','对外贸易'],
 '游戏电竞': ['王者荣耀','英雄联盟','电竞','游戏攻略','手游攻略','原神','绝地求生'],
 '学习方法': ['学习方法','学习效率','记忆宫殿','高效学习','记忆技巧',
  '专注力训练','备考','考研','学霸'],
 '历史社会': ['历史','二战','朝代','毛泽东','古代史','明朝','清朝','宋朝',
  '秦朝','唐朝','战争史','政治学','国际关系','王朝','近代史'],
 '摄影设计': ['Photoshop','UI设计','UX设计','摄影','修图','平面设计',
  '视觉设计','字体设计','排版教程','PS修图'],
 '科普知识': ['科普','天文','航天','宇宙','量子','物理学','化学','自然科学']
});
const ESCAPE=/[.*+?^${}()|[\]\\]/g;
function matches(text,terms){
 const t=String(text||'');
 return terms.filter(term=>{
  const re=new RegExp(term.replace(ESCAPE,'\\$&'),'i');
  if(!re.test(t))return false;
  // Abbreviations should match standalone ASCII tokens, not parts of words.
  if(/^[A-Za-z0-9]+$/.test(term)&&term.length<5){
   const boundary=new RegExp('(^|[^A-Za-z0-9])'+term.replace(ESCAPE,'\\$&')+'(?=$|[^A-Za-z0-9])','i');
   return boundary.test(t);
  }
  return true;
 });
}
export function titleSignals(text){
 const found={};
 for(const [topic,terms] of Object.entries(TERMS)){
  const hits=matches(text,terms);
  if(hits.length)found[topic]=hits;
 }
 return found;
}
const sortedSources=v=>(v.sources||[]).some(s=>s.folderName==='默认收藏夹');
export function inventoryFingerprint(inventory){
 const members=(inventory?.members||[]).map(v=>[v.folder_id,v.bvid,v.title,v.intro]);
 return createHash('sha256').update(JSON.stringify(members)).digest('hex');
}
export function buildEvidenceCandidates({inventory,workflow}={}){
 if(!inventory||!workflow)throw Error('inventory_and_workflow_required');
 const byBvid=new Map();
 for(const row of inventory.members||[]){
  if(!row.bvid)continue;
  if(!byBvid.has(row.bvid))byBvid.set(row.bvid,{title:'',intros:[]});
  const e=byBvid.get(row.bvid);
  if(String(row.title||'').length>e.title.length)e.title=String(row.title||'').slice(0,250);
  if(row.intro && !e.intros.includes(row.intro))e.intros.push(String(row.intro).slice(0,300));
 }
 const proposals=[],summary={observed:workflow.stats.unique,originalReview:0,
  titleSpecific:0,needsHumanReview:0,ambiguousTitle:0,introOnly:0,
  titleEvidenceDefault:0,byTopic:{}};
 for(const v of workflow.videos){
  if(!['conflict','description_review','unclassified'].includes(v.decision))continue;
  summary.originalReview++;
  const src=byBvid.get(v.bvid)||{title:v.title,intros:[]};
  const title=titleSignals(src.title);
  const intro=titleSignals(src.intros.join(' '));
  const categories=Object.keys(title);
  const possible=Object.keys(intro);
  const chosen=categories.length===1?categories[0]:null;
  // User-facing status is still an inference; conflicting old cues prevent
  // automatic promotion.
  const safe=v.decision!=='conflict' && chosen &&
   (!v.suggestion||v.suggestion===chosen) &&
   (!v.candidateTopics?.length||v.candidateTopics.includes(chosen)) &&
   // If the title is in a broad general-purpose coding/AI context, an
   // conflicting intro is still a good reason to abstain.
   !possible.some(topic=>topic!==chosen && categories.includes(topic));
  const status=safe?'title_specific_proposal':
    categories.length>1?'ambiguous_title':
    categories.length===0&&possible.length===1?'intro_review_only':'requires_human_review';
  const topic=safe?chosen:null;
  if(safe){
   summary.titleSpecific++;
   summary.byTopic[topic]=(summary.byTopic[topic]||0)+1;
   if(sortedSources(v))summary.titleEvidenceDefault++;
  }else{
   summary.needsHumanReview++;
   if(status==='ambiguous_title')summary.ambiguousTitle++;
   if(status==='intro_review_only')summary.introOnly++;
  }
  proposals.push({
   bvid:v.bvid,status,topic,confidence:safe?'specific_title_signal':'unverified',
   originalDecision:v.decision,defaultSource:sortedSources(v),
   titleSignals:title,introSignals:intro,
   existingDescriptionSuggestion:v.suggestion||null,
   requiresHumanApproval:true,accountWriteAllowed:false
  });
 }
 proposals.sort((a,b)=>Number(b.defaultSource)-Number(a.defaultSource)||a.bvid.localeCompare(b.bvid));
 return {version:RULE_VERSION,inputFingerprint:inventoryFingerprint(inventory),
  generatedAt:new Date().toISOString(),ruleVersion:RULE_VERSION,summary,proposals,
  accountRequests:0,accountWrites:0,source:'offline_title_description_only'};
}
export async function saveEvidence(dataDir,result){
 const path=join(dataDir,FILE_NAME),tmp=path+'.'+process.pid+'.tmp';
 await writeFile(tmp,JSON.stringify(result,null,2),{mode:0o600});
 await rename(tmp,path);return path;
}
export async function loadEvidence(dataDir,inventory){
 let raw;
 try{raw=JSON.parse(await readFile(join(dataDir,FILE_NAME),'utf8'))}
 catch(e){if(e.code==='ENOENT')return null;throw e}
 if(raw?.version!==RULE_VERSION||raw.inputFingerprint!==inventoryFingerprint(inventory))
  return null;
 return raw;
}
