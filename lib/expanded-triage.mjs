// Second-pass conservative subject classification for already-observed metadata.
// No platform access; no automatic user approval. Ambiguous hits abstain.
const RULES={
  '英语':[/\b(?:come up|would do|chew|true|pronunciation|spoken english|english grammar|listening comprehension)\b/i,/英语|英文|英式口音|美式口音|音标|弱读|连读|英语发音|英语口语|英语听力|语法|发音训练|词汇量|英语学习|外国人教英语/],
  '电影创作':[/短片.*(?:制作|教程|生成|分镜)|(?:制作|生成|剪辑).*短片|漫剧|影视制作|电影创作|运镜|镜头语言|剪映|剪辑|视频生成|视频模型|视频特效|视频素材|AI视频|AI短片|视频工作流|动画模板|动画插件|镜头控制|景别|电影感|配音|音效|视频创作|拍摄干货|后期制作|FCP动画|\bFinal Cut Pro\b/i],
  '编程':[/\b(?:MQTT|Flutter|HTML|CSS|Javascript|Typescript|Python|Rust|Java|React|Vue|Angular|Tauri|Docker|Redis|SQLite|MySQL|PostgreSQL|C\+\+|Kotlin|Swift|npm|CLI|IDE|API|OCR|FFmpeg)\b/i,/代码|编程|开发者|程序开发|接口开发|软件工程|架构设计|源码|框架|组件库|库开发|前端|后端|数据库|高并发|代码仓库|网络协议|物联网|鸿蒙|自动化脚本|浏览器自动化|服务器部署|文档转Markdown|开源软件|开源工具|开源项目|开源库|软件安装|软件推荐|开发工具|电脑工具|终端|系统工具|远程桌面|\bGitHub\b/i],
  'AI':[/\b(?:ChatGPT|DeepSeek|Claude|Codex|OpenClaw|GPT|LLM|RAG|Agent|Gemini|Kimi|MCP|AIGC|OpenAI|Anthropic|Qwen|GLM|n8n|Qoder|CodeBuddy|CodeArts|WorkBuddy|ComfyUI)\b/i,/大模型|人工智能|智能体|提示词|模型微调|模型推理|模型压缩|AI助手|模型训练|AI工具|AI应用|人工智能工具|模型调用|智能工作流|AI浏览器|机器学习|AI知识库|语义检索|神经网络|模型部署|Token|上下文压缩|AI编程|模型额度|AI自动化/],
  '体育':[/篮球|足球|乒乓|羽毛球|投篮|三分线|运球|跳投|游泳|自由泳|蛙泳|仰漂|踩水|推投|抛投|球技|拳击|网球|体能测试|后撤步|射门|足球赛|排球|\bNBA\b|\bCBA\b/i],
  '财经商业':[/股票|股市|A股|科创板|港股|基金|投资|量化交易|交易训练|存款|泡沫|证券|金融|生意|创业|商业模式|融资|营销|卖货|摆摊|经营|商人|赚钱|变现|财务|资本|交易平台|私募|期货|外贸|商战|股权|资产管理|商业分析/i],
  '心理情感':[/婚姻|夫妻|老公|老婆|情绪|心理|恋爱|社交|人生感悟|人情世故|自我认知|人格|三观|心态|钝感力|心理学|情感|反内耗|厚黑|亲密关系|人脉|人际关系|识人|职场PUA/i],
  '健身健康':[/健身|训练|增肌|减脂|养生|康复|体态|健康|脂肪|营养|疾病|患者|医生|医学|睡眠|护肤|面部瑜伽|瑜伽|失眠|肩颈|腰椎|关节|防溺水/i],
  '职场':[/职场|求职|就业|招聘|加班|工资|简历|面试|工作能力|评审会|领导|同事|升职|涨薪|裁员|转正|打工|上班|国企|职业规划|远程工作|办公技巧|\bOffice\b/i],
  '摄影设计':[/摄影|照片|写真|修图|设计|画画|素描|插画|手绘|审美|\bUI\b|\bUX\b|Figma|PhotoShop|\bPS\b|配色|视觉艺术|排版|构图|字体|动画设计|图像生成|AI出图|\bNano Banana\b/i],
  '学习方法':[/如何学习|学习方法|记忆|备考|考研|教学法|高效学习|学习效率|刷题|学霸|高考|题库|记笔记|知识整理|课堂学习|思维导图/i],
  '科普知识':[/物理|化学|数学原理|现象是什么|地球|自然界|生物学|天文|宇宙|科学实验|科学原理|机械原理|科技发展|科普|概率|黎曼猜想/i],
  '数学':[/数学|黎曼猜想|微积分|几何|函数|代数|概率论|数列|拓扑|方程|线性代数/i],
  '音乐':[/歌曲|歌手|音效|乐谱|简谱|和弦|乐器|唱歌|声乐|音乐|音频素材|钢琴|吉他|曲谱/i],
  '自媒体':[/自媒体|博主|账号运营|新号|粉丝|直播带货|投流|短视频运营|营销号|\bUP主\b|公众号|视频号|流量变现|内容营销|剪藏|网红运营/i],
  '历史社会':[/毛主席|毛泽东|叶帅|周星驰.*电影|社会学|历史|战争|伊朗|古代|朝代|世界史|政治|社会问题|近代史|百家讲坛|伟人|解放军|党史|国际局势|殖民|社会主义|经济史/i],
  '写作小说':[/写小说|文学|小说|剧本|网文|写作|文字表达|诗词|散文|文案|写文|修仙文|读书心得/i],
  '生活':[/生活|做饭|美食|厨艺|麻酱|鸡蛋|煮|烧烤|鞋子洗护|清洁|冰箱|空调|家居|洗衣|旅行|旅游|攻略|整理收纳|生活经验|宠物|钓鱼|家电/i],
  '游戏电竞':[/游戏|王者荣耀|吕布|夏侯惇|电竞|\bSteam\b|游戏设置|手游|上分|英雄联盟|原神/i]
};
const MATCHES=Object.freeze(Object.fromEntries(Object.entries(RULES).map(([k,v])=>[k,Object.freeze(v)])));
export function expandedTitleSignals(title){
 const text=String(title||'');const groups={};
 for(const [topic,terms] of Object.entries(MATCHES)){
  const hits=terms.filter(re=>re.test(text)).map(re=>re.source.slice(0,70));
  if(hits.length)groups[topic]=hits;
 }
 return groups;
}
const STRONG_PREFIXES=[
  [/^(?:重温《[^》]+》|周星驰|电影《|影评|电影解说)/,'电影创作'],
  [/^(?:如何|怎么|一分钟).*?(?:英语|发音|单词|语法)/,'英语'],
  [/^(?:如何|怎么).*?(?:煮|炒|做饭|烹饪|美食)/,'生活'],
  [/^(?:如何|怎么).*?(?:跳投|投篮|踩水|自由泳|游泳)/,'体育']
];
const KNOWN_OVERRIDES=[
 [/大话西游|重温《|夕阳武士/,'电影创作'],
 [/\bDeepSeek\b|\bClaude\b|\bCodex\b|\bGPT\b|\bAgent\b/i,'AI'],
 [/麻酱汁|蟹黄蛋|鸡蛋的灵魂吃法/,'生活'],
 [/存款.*泡沫|金融圈|量化交易|股票|科创板/,'财经商业'],
 [/游泳|自由泳|仰漂|抛投|三分线|踩水/,'体育'],
 [/习近平|毛主席|老政委|战争|近代史|伊朗/,'历史社会']
];
export function triageExpanded(record,{title,description}={}){
 const heading=String(title||record.originalTitle||'').trim();
 const isInvalid=record.originalDecision==='invalid';
 const source=heading==='已失效视频'?String(description||'').slice(0,600):heading;
 if(!source || source==='已失效视频')return {status:'insufficient_evidence',topic:null,reason:'没有有效的主题文本',provisional:true};
 const signals=expandedTitleSignals(source);
 const topics=Object.keys(signals);
 const explicit=KNOWN_OVERRIDES.filter(([re])=>re.test(source)).map(([,topic])=>topic);
 const distinct=[...new Set(explicit)];
 let winner=null,why='';
 if(distinct.length===1){winner=distinct[0];why='标题出现明确主题短语';}
 else if(topics.length===1){winner=topics[0];why='仅出现一个主题类别的词组';}
 else if(topics.length>1){
  // A title about a named application is not always a programming tutorial.
  const structured=topics.filter(x=>!['AI','编程'].includes(x));
  if(structured.length===1){winner=structured[0];why='有明确的垂直主题，保留跨主题风险';}
 }
 const status=!winner?'ambiguous_or_insufficient':isInvalid?'invalid_description_hint':'expanded_title_hint';
 return {status,topic:winner,reason:winner?why:'存在多个主题或证据不足',provisional:true,
  sourceType:isInvalid?'description_only':'title_only',confidence:winner?(isInvalid?'low':'tentative'):'unknown',
  candidates:topics};
}
