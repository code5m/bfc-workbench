import {homedir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {deriveWorkflow} from '../lib/workflow.mjs';
const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const read=async n=>{try{return JSON.parse(await readFile(join(dir,n),'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
const inventory=await read('inventory-rescan-v2.json');
const classification=await read('v3-classification.json');
const description=await read('description-review.json');
const overrides=await read('manual-review-overrides.json');
const guard=await read('account-access-guard.json');
const copySummary=await read('copy-summary.json');
const evidence=await read('local-evidence-proposals.json');
const workflow=deriveWorkflow({inventory,classification,description,overrides,guard,copySummary});
const titleById=new Map(workflow.videos.map(v=>[v.bvid,v.title]));
// Narrow metadata review rules. Do not infer what video actually shows; these
// are editorial draft decisions, not user-approved categories or account writes.
const rules=[
 ['AI',/(?:Claude Code|ClaudeCode|Codex|OpenClaw|ChatGPT|DeepSeek|Gemini|Agentic RAG|\bRAG\b|大模型|智能体|MCP|LLM)/i],
 ['编程',/(?:Rust|SQL|前端|后端|Python|源代码|源码级|代码重构|数据库|\bLinux\b|\bDocker\b|\bCLI\b)/i],
 ['电影创作',/(?:Blender|Seedance|短片.*制作|动画模板|AI短片|影视级|视频生成|做成视频|一镜到底|AI生视频)/i],
 ['心理情感',/(?:人情世故|心理技巧|社交法则|人际关系)/i],
 ['历史社会',/(?:朝代|历史|战争史)/i],
 ['学习方法',/(?:学霸|学习效率|学习方法|吃透一门学科)/i],
 ['健身健康',/(?:营养素|健身|康复训练)/i],
 ['科普知识',/(?:宇宙|天文|量子|物理学)/i],
];
const choices={version:1,decisions:{}},excluded=[];
for(const item of evidence.proposals){
 if(item.status!=='title_specific_proposal')continue;
 const title=titleById.get(item.bvid)||'';
 const typed=rules.find(([topic,pattern])=>topic===item.topic&&pattern.test(title));
 const contra=Object.keys(item.introSignals||{}).filter(k=>k!==item.topic);
 const reject=contra.length||!typed||/量化交易|GitHub.*(?:软件下载|开源软件|热门项目|热榜|App)|国内用户.*注册|免费会员|白嫖|注册教程|风控|验证码|开源软件|游戏帧|PS平替/i.test(title);
 if(reject){excluded.push(item.bvid);continue;}
 choices.decisions[item.bvid]={topic:item.topic,title,
  reason:'标题明确描述'+item.topic+'主题（'+typed[1].source.slice(0,45)+'），仅本地元数据复核，内容尚未核验'};
}
const file=join(dir,'local-semantic-review-choices.json');
const previous=await read('local-semantic-review-choices.json');
if(previous&&Object.keys(previous.decisions||{}).length)throw Error('existing_review_choices_require_merge');
const tmp=file+'.tmp-'+process.pid;await writeFile(tmp,JSON.stringify(choices,null,2),{mode:0o600});await rename(tmp,file);
console.log(JSON.stringify({selected:Object.keys(choices.decisions).length,excluded:excluded.length,original:evidence.proposals.length,unresolved:evidence.proposals.length-Object.keys(choices.decisions).length}));
