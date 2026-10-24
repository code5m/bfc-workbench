import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {expandedTitleSignals,triageExpanded} from '../lib/expanded-triage.mjs';
import {TARGETS} from '../lib/workflow.mjs';

const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const read=async name=>JSON.parse(await readFile(join(dir,name),'utf8'));
const snapshot=await read('browser-live-snapshot.json');
const inventory=await read('inventory-rescan-v2.json');
const history=new Map();
const authors=new Map();
for(const row of inventory.members||[]){
 if(row.author)authors.set(row.bvid,row.author);
 const texts=history.get(row.bvid)||[];
 for(const key of ['intro','description','desc'])if(typeof row[key]==='string'&&row[key].trim())texts.push(row[key]);
 history.set(row.bvid,[...new Set(texts)]);
}
const specific=[
 ['英语',/英语|英文|单词|音标|美音|英音|雅思|托福|连读|口语|\bEnglish\b/i],
 ['体育',/篮球|足球|乒乓|羽毛球|游泳|投篮|运球|自由泳|蛙泳|跳投/],
 ['电影创作',/剪辑|分镜|运镜|漫剧|视频生成|AI视频|做视频|电影解说|影评|Remotion/i],
 ['摄影设计',/摄影|修图|写真|插画|画画|生图|文生图|图像生成|出图|平面设计|Figma/i],
 ['生活',/做饭|炒菜|烹饪|菜谱|厨艺|收纳|清洁|洗衣|美食/],
 ['数学',/数学|微积分|几何|代数|方程|数列/],
 ['游戏电竞',/王者荣耀|英雄联盟|原神|手游|电竞/],
 ['音乐',/唱歌|声乐|钢琴|吉他|和弦|乐谱/]
];
const records=snapshot.members.map(row=>{
 const base=triageExpanded({}, {title:row.title});
 const descriptions=history.get(row.bvid)||[];
 let topic=base.topic,reason=base.reason,confidence=topic?'medium':'unknown';
 const hits=specific.filter(([,re])=>re.test(row.title)).map(([name])=>name);
 if(new Set(hits).size===1){topic=hits[0];reason='标题明确指向具体主题';confidence='medium';}
 if(!topic&&descriptions.length){
  const signals=Object.keys(expandedTitleSignals(descriptions.join('\n')));
  if(signals.length===1){topic=signals[0];reason='历史同 BV 简介提供单一主题证据';confidence='low';}
 }
 return {bvid:row.bvid,title:row.title,sourcePage:row.source_page,topic,targetFolder:topic?TARGETS[topic]:null,
  status:topic?'metadata_classified':'needs_content_review',confidence,reason,
  candidates:Object.keys(expandedTitleSignals(row.title)),descriptionAvailable:descriptions.length>0,
  evidenceSource:reason.startsWith('历史')?'historical_description':'current_snapshot_title',humanApproved:false};
});
// Prefer the stated subject over incidental hashtags such as “生活” or “妈妈”.
const primarySubjects=[
 ['财经商业',/股票|炒股|股价|游资|龙虎榜|涨停板|量化交易|打板策略/],
 ['体育',/台球|篮球|乒乓|足球|羽毛球|投篮|跳投|上篮|胯下|运球|三威胁|球型|手架|低杆|高杆|加塞|贴库|翻袋|瞄准|发球|接发球|弧圈球|游泳|蛙泳|自由泳|蝶泳|防守突破|球场|转身技巧/],
 ['健身健康',/倒立|俄挺|增肌|减脂|练背|哑铃|卧推|俯卧撑|引体|跳绳|八段锦|脊椎|肩胛|肩颈|翼状肩|猥琐颈|筋膜|卷腹|前锯肌|肱三头肌|体态矫正/],
 ['生活',/年夜饭|炸带鱼|焖饭|煮蛋|包饺子|饺子皮|做饭|炒菜|烹饪|空气炸锅|食谱|黄焖鸡|土豆片|做菜|梭子蟹|神奇架子|瓷砖|美缝|房车|窗帘|衣柜|扫地机/],
 ['游戏电竞',/花木兰|关羽|貂蝉|李元芳|元歌|公孙离|阿离|米莱狄|王者荣耀|绝区零|原神|盲僧|亚索|红开澜|赵怀真/],
 ['编程',/Godot|\bRust\b|\bJava\b|\bPython\b|\bDocker\b|\bTauri\b|数据库|开源.*(?:角色库|序列)|代码.*架构图|游戏引擎|计算机|操作系统/i],
 ['电影创作',/AI配音|AI剪辑|视频生成|AI视频|视频模型|短剧制作|漫剧|分镜|视频压缩|影视解说|手搓.*视频|Remotion|剪映|视频特效/i],
 ['英语',/英语|英文|词根|音标|元音|辅音|英音|美音|英语口语|连读|缩读|弱读|雅思|托福/],
 ['财经商业',/游资|股价|股票|炒股|量化.*(?:交易|打板)|打板策略|龙虎榜|主升浪|涨停板|涨跌停|复盘.*股票/],
 ['职场',/\bPPT\b|AIPPT|答辩|简历|求职|招聘|调岗降薪|公司劝退|劳动仲裁|员工.*工作群|离职赔偿/i],
 ['学习方法',/论文.*降重|降重方法|考研|研招网|招生人数/],
 ['音乐',/Bbox|歌曲|唱歌|声乐|钢琴|吉他|\bRemix\b/i]
];
// User-selected best-fit policy: resolve overlapping subjects by practical use.
const broader=[
 ['电影创作',/剪视频|视频.*(?:生成|制作)|生成.*视频|Seedance|可灵|海螺|Sora|Veo|Blender|动画|追剧|新剧|电影|影视|短剧|马赛克|关键帧|一镜到底|特效/i],
 ['英语',/全英|老外.*(?:说|描述)|词根|词缀|词汇|字母组合|听力|发音|麦说|形容词|动词|介词|时态|美剧.*(?:学|练)|adj\.|adjectives|would like|I know|Spring既|mouth|been|英语/i],
 ['摄影设计',/工程图|建模|Meshy|Tripo|混元3D|图像|绘画|设计|画面.*AI|拍照|构图|美术/i],
 ['财经商业',/副业|孙宇晨|财富|社保|养老金|买房|房价|经济|理财|炒股|货币|收入|保险|赚钱|商业|通胀|关税/i],
 ['职场',/公司|下属|领导|职场|工作规划|薪|牛马|裁员|汇报|面试|管理方案/i],
 ['体育',/刘国梁|王楚钦|马龙|张继科|乒乓|篮球|足球|男篮|男足|上篮|三分|后卫|防守|突破|跳步|试探步|实战转身|发力|蝶泳|踩水|泳姿|拳|搏击|跑步|跳绳/i],
 ['健身健康',/营养|肉.*(?:吃|更高)|前额叶|体检|遗传|大脑|脑中|睡眠|肌肉|减肥|减脂|体态|拉伸|腰|颈|痛|呼吸|医院|癌|养生|健康/i],
 ['生活',/肉|去腥|厨房|做菜|食谱|碗|菜|煎|炒|炖|蒸|烤|买车|汽车|洗|家居|装修|旅行|旅游|衣服|穿搭|宠物/i],
 ['学习方法',/学习|学什么|知识管理|笔记|记忆|读书|专注|效率|复习|考试/i],
 ['心理情感',/思维|人性|本性|说话|表达|关系|对象|主体性|紧张|掌控|情绪|孩子|人生|成功|人际|恋爱|死亡|操控|内耗|松弛|自信|自律|认知/i],
 ['音乐',/音乐|小曲|歌曲|发声|练声|唱|音色|歌曲|BGM|间奏|旋律/i],
 ['历史社会',/中国|战争|缅北|出兵|历史|社会|政治|阶级|毛泽东|毛主席|国家|年轻人.*专家/i],
 ['写作小说',/修仙|小说|网文|写作|文案|词元.*消费|剧情/i],
 ['游戏电竞',/游戏|三国杀|名将杀|XX杀|Steam|王者|电竞/i],
 ['AI',/AI|skill|grok|opus|prompt|harness|模型|智能|词元|神经网络|涌现|GPT|Claude|agent|MCP|机器学习/i],
 ['编程',/开源|软件|电脑|Windows|Linux|程序|代码|隐私|手机号.*(?:扒|翻)|逆向|浏览器|插件|工具|网站|编程/i],
 ['科普知识',/螳螂|捕蜂|混沌|科学|物理|化学|宇宙|自然|动物|诺奖|信息量|贝叶斯|凯利|原理/i]
];
broader.unshift(
 ['心理情感',/怎么识别.*应对|一开口|组队被替换|兄弟嘴脸|规则外|艾老师|家有儿女|勇敢说|我被夺舍|真正的钥匙/i],
 ['生活',/吃完.*口渴|街边男生.*抓|媲美进口|顶配真香|并不贵的东西|帅是一辈子|帅上加帅|如何查看.*张卡/i],
 ['职场',/卷吧.*卷吧/i],
 ['音乐',/声音.*安静|世界年轻时/i],
 ['科普知识',/冷知识.*保命|大白熊|狼群/i],
 ['摄影设计',/叁拾.*画生/i],
 ['历史社会',/信则有.*信则无/i],
 ['财经商业',/优化.*策略/i],
 ['英语',/value你读/i],
 ['数学',/希尔伯特空间/i],
 ['摄影设计',/书法|起笔/i],
 ['编程',/U盘系统|AI拉平|码农/i],
 ['生活',/西瓜|大棚|擦不干净|同款车|激光封边|购房|车险|售楼员|海岛|电梯|小区|基站|提什么车|东西.*并不贵/i],
 ['健身健康',/青霉素|头往前|\d+.*动作.*练|整套练习/i],
 ['财经商业',/元\/瓦|高价值信息|6000块|10w赚|不该.*责任/i],
 ['心理情感',/语言.*钥匙|事未至|人情世故|我很好|回去.*没有人|暴风雨天气|改变就是|只有我在场|该怎么.*描述|不该.*责任/i],
 ['生活',/扑克|解压小玩具|品牌|捆绑|樵夫结|塑料袋|502胶水|水暖|镜片|眼镜|扫描王|垃圾国货|省钱|小酒|叠被套|漂移车|推拉门|防盗门|婚房|五菱|小三居|新房验收|空气炸锅|鞋|奶昔|沙发|牙膏|不锈钢|盐|养牲口|玩具|黏土|月季|床单|养狗|六种狗|偷电缆|长相|嘴巴|小表情|小脸|漂亮|女友|车祸|穷游|角磨机|万精油|被套|这字儿|奶昔/i],
 ['财经商业',/算力五大|香港汇丰|药业|白马股|炒|营商环境|国资委|龙头股|横盘|行情|指标|年入|米粉|地摊|挣了多少|穷人|越来越穷|赚到|\b10w\b/i],
 ['体育',/\d+°球|练球|运一次球|柯冉|保罗乔治|锋卫|短跑|运动爆发|跑和跳|俄挺|沙包|鞭杆|投手|环意大利|车队下坡|埃菲内普尔|pro骑车|樱木|水弹|弹弓/i],
 ['游戏电竞',/关羽|貂蝉|李元芳|公孙离|阿离|萧炎|三千雷|米莱狄|飞雷神|妲己|红开澜|食人鱼|赵怀真|打野|发育路|拿战力|五排|双排/i],
 ['摄影设计',/相机|M挡|女摄|阳光画|Bbox|vlog/i],
 ['音乐',/Remix|专辑|杰伦|I Wish My Mind/i],
 ['心理情感',/淡定|边界|恐惧|迷茫|年后受益|当下|圣贤|王阳明|可怕|恶的善良|气氛|结婚|活成什么|上头|善缘|狂这个|少年|长大|胡说八道|躺平|欺凌|独自|穷$|纠结|爱过|分开了/i],
 ['历史社会',/紫微|飞星四化|九紫离火|算命|四柱|八卦图|传统文化|占卜|星图|黄道|日本.*核|核辐射|飞行学员|武装直升机|菲律宾|防空导弹|领袖|地理|一秒天黑|老师.*传承|美丑基因|古早复仇/i],
 ['健身健康',/脉法|病因|早晚四个|瘦又壮|睡姿|隆鼻|螨虫|痘|基因|鼻撑|平衡阴阳|本 草|敷|速成鸡/i],
 ['学习方法',/低龄规划|高中排行榜|名校|语文|法学|幼牌/i],
 ['编程',/算法|跑分|3A网游|pcie|固态|电容|点焊|电子电路|监控|微信|接头|盖房子|自动化|自动驾驶|组件进化|资料|免费版/i],
 ['科普知识',/吹翼|飞机|发动机|动力装置|多孔真空|隔热棉|无人飞机|betafpv|Pavopico|水火箭|Fluent|多相流|仿真|微型水泵|工业|子 弹/i],
 ['职场',/技术永无出路|外包|裁人|高手.*策略/i],
 ['自媒体',/俞敏洪董宇辉|小杨哥|直播|营销号|引流/i],
 ['写作小说',/文字|诗|历时性|共时性/i],
 ['电影创作',/纪录片|汇演|漫画秀|脱口秀|蒋龙|从天而降|瞬间移动/i],
 ['英语',/[：:]\s*[a-z][a-z\s]+$|\b(?:tonic|scope|simp|pseudonym|quarter|take warning|roller coaster)\b/i],
 ['生活',/全屋|定制|瓷砖|美缝|衣柜|柜门|电视柜|吊顶|玻璃门|窗户|系统窗|挡水条|淋浴|房车|二手房|交房|公摊|户型|地基|大理石|木板|多层板|颗粒板|宜家|床垫|选床|柜体|墙面|发光墙|地面保护膜|收口|防水|电工|尾插|维修|窗|架子|绿植|花|植物|绿萝|土豆|雪糕|火锅|苦瓜|黄焖鸡|周黑鸭|煮蛋|食用油|酒精酒|纯梁酒|磨刀|热锅|榴莲|冰淇淋|拉面|早餐|吃面|露营|绳结|睡袋|冲锋衣|优衣库|男装|零食|代工厂|停车|出库|挪车|车位|手机卡|合约卡|注销|网购|模特/i],
 ['健身健康',/中医|倪海厦|倪师|浮脉|表证|易筋经|八段锦|锯肌|三头肌|卷腹|练背|肱骨|肩胛|翼状肩|久坐|低头|矫正|掉秤|崴脚|筋膜|寿命|端粒|制氧|脱发|头油|头屑|护肤|瘦脸|大小脸|前突|露龈|轻薄.*饱满|鼻梁|生物课|锻炼|身体轻松|晚饭|蟑螂|耳朵|助力带/i],
 ['财经商业',/抄底|逃顶|趋势线|支撑线|阻力线|F10|机构票|盘中|还款|违约金|央妈|黄金|ETF|OBV|量子.*fo|查假账|乡村.*产业|不亏钱|海缆龙头|复苏行业|半导体.*主线|亏钱|欠.*钱|农民.*几毛|统一大市场|法人代表/i],
 ['数学',/不等式|柯西|压轴题|正方形|面积|结 构 数 学|九九乘法|数完.*大米/i],
 ['体育',/直板|挑打|WTT|大满贯|滑板|飞盘|台球|角度.*球|球.*齿轮|球该怎么打|接球|命中率|力的交接点|中杆|王旭冉|反角|窒手|转身技巧|动作调整/i],
 ['游戏电竞',/绝区零|音游|边路|斧助|元歌|S35|盲僧|亚索|六一中路/i],
 ['历史社会',/霸凌|防拐|叛徒|东汉|刘秀|东风快递|美帝|美俄|法院|被打|下跪|保护.*自己|女孩.*捂嘴|老年人.*厕所|学校.*血/i],
 ['学习方法',/留学|高校|大学|答辩|导师|参考文献|知网|证书|学自动化/i],
 ['科普知识',/量子力学|反比定律|高维空间|木头.*融化|电机|电路板|星舰|火山|飞行器|人体通信|无刷|温度|能有多少度/i],
 ['编程',/cmd|alist|potplayer|PCmask|无线充电|硬盘|Aria2|油猴|网盘|NFC|B站.*崩|App|APP|安卓|充电|机械硬盘|冷热分离|图表|可视化|神器/i],
 ['摄影设计',/Procreate|画笔|色彩|透视圆|纹理/i],
 ['电影创作',/达芬奇|胶片|字幕|语音转文字|找视频|航拍|大疆如影|视频.*配方/i],
 ['职场',/员工|邮箱|工作群|上班|工作中|PPT|下划线|土木|工地/i],
 ['写作小说',/诗人|一首诗|余华|文采|摘抄|语录|文字|古书|金瓶梅/i],
 ['心理情感',/曾仕强|哲学|脾气|老实|讲.*逻辑|讲话|口才|沟通|好好爱|爱自己|男朋友|前男友|喜欢.*女生|出轨|改变别人|迎合|不喜欢|孤独|消耗|思路|慎独|反驳|对话|发言|社恐|失败|心酸|过去了|女儿|浪漫|情境|状态|25岁|过渡|强者/i],
 ['体育',/挡拆|低位转身|迷踪步|拨球|球悬浮|释放球|李悦洲|脚步.*走步|活髋|角度球|袋口球|翻底袋|控力技巧|长距离球|反角球|半颗球|正反角/i],
 ['英语',/Pte\d|词根|词源/i],
 ['AI',/Clawdbot|Trae|GLM\d|反重力|缓存检索增强|机器人.*关键词/i],
 ['编程',/sms.activate|接码|OpenSpec|Hyper.?V|Kali|网络安全|信息安全|技术资讯|容器技术|1Panel|Power Automate|多维表格|屏幕共享|命令.*调研|通讯录.*后台|中转站/i],
 ['摄影设计',/图片转3D|图片.*3D|Hitem3D|矢量图|复古风/i],
 ['电影创作',/视频压缩|编解码|视频究竟|视频.*差距|演技|洪金宝/i],
 ['音乐',/倒转.*声音|pop music|Playlist/i],
 ['财经商业',/大盘|\d+点|猪周期|股份|财商|利润表|GDP|银行股|大a五佳|顾客不买单/i],
 ['心理情感',/切换.*状态|跳过回答|回应目的|有感而发|戾气|吃过亏|善缘|做好自己|欲望|真爱|错付|接吻|老公|受委屈|家兴家败|惹尘埃|自己开心|直女|男通|情敌/i],
 ['学习方法',/作文|语文|补课|高中生|教育方法|应试教育/i],
 ['生活',/火鸡面|水龙头|抹布|饮料|再来一瓶|芥末|泡虾|拉链|网约车|出租车|开关闸|洋葱|凉拌|煲仔饭|海鲜|甘蔗|调料|裤绳|密码锁|水电|骚扰电话|生僻字|尚界H5|余承东/i],
 ['健身健康',/嘴馋|瘦了|含糖|生长激素|补钙|结石|戒烟|抗老|补剂|氰化物|按摩|强壮|胸廓|鼻撑/i],
 ['科普知识',/电子.*路径|费曼|路径积分|氧化|生物进化|Oloid|增压泵|无烟炉|感应加热|压力波|地面.*岩浆|逻辑学|辩证法/i],
 ['职场',/离职|开会|这个会|把班上顺|老板/i],
 ['自媒体',/公众号|排版|完播率|抖音号/i],
 ['历史社会',/集团军|穿越机|110|无权无势|四个电话/i],
 ['体育',/台球|桌球|球型|球形|球感|球场|球搭子|进球|瞄准|准度|加塞|顺塞|反塞|贴库|中袋|翻袋|杆法|杆速|低杆|高杆|扎杆|出杆|运杆|手架|分离角|清台|颗星|开球|发球|接发|反手|下旋|长胶|弧圈|樊振东|奥沙利文|三威胁|胯下|跨下|变向|虚晃|拖曳|后挖|前挖|快攻|联防|东契奇|欧文|德文|朱正|转髋|抬头蛙|深水区|公开水域|攀岩|爬绳/i],
 ['财经商业',/游资|妖股|主升浪|主力|龙虎榜|做t|量价|涨跌|涨停|跌停|波段|华尔街|斐波那契|陈小群|章盟主|徐翔|达利欧|股民|估值|股价|产能过剩|选股/i],
 ['生活',/披萨|饺子|梭子蟹|铁锅|酒店|买电视|扫地机|物业|中介|租房|房东|自行车|开车|驾照|车道|车内|酒驾|交警|飞机票|烧水壶|水杯|杯子|小蜡烛|净水器|水电|升降桌|扳手|绞刑结|穿什么|汉服|小鸡/i],
 ['历史社会',/警察|民警|警方|公安|举报|巡视组|诬陷|威胁|耳光|取证|治安|刑事|拘留|器官|人贩|乌克兰|泽连斯基|铁原|阻击战|央视|毛选/i],
 ['健身健康',/药企|生发|防脱|膝盖|哑铃|小臂|胸廓|肩内扣|心跳|血管|mmHg|就医|低卡|饱腹|易胖|体质|防虫|瞳距|腿型|饮食|水果|生病|多巴胺/i],
 ['职场',/HR|劝退|赔偿|2N|双休|张雪峰|志愿|招生|落榜/i],
 ['心理情感',/爱你|身体语言|聊下去|直话直说|服从|家是|立场|观点|无理要求|修心|开悟|内观|心法|修行|活下去|妈妈|亲戚|感触|眼神/i],
 ['音乐',/练歌|听听歌|口诀歌/i],
 ['科普知识',/塑料成型|太阳|螺旋桨|光伏|核磁|光刻|测量距离|PID/i],
 ['编程',/网速|网络卡|PCB|Type-C|Cursor|QMT|通达信/i],
 ['英语',/\b(?:off|the|breakfast|pte|ice|sin|cos)\b|鼻音|元音|长难句|前缀|词义|词性|词源|语感/i],
 ['数学',/sin|cos|三角函数|填数题|大数相减|黎曼|四维空间|解法|此题/i],
 ['编程',/DTU|串口|485|嵌入式|操作系统|计算机|三进制|爬虫|Graph令牌|ER 图|图形编辑|可视化引擎|Rust|Marvis|OmniGet|命令行|服务器|代理|邮箱机|网页.*App/i],
 ['AI',/黄仁勋|马斯克|豆包|TTS|OmniVoice|龙虾|爱马仕|SearXNG|kiro|知识库|资讯日报自动|长文本/i],
 ['电影创作',/MP4|高斯泼溅|短视频|生视频|摄像头|三维世界|素材|编剧|故事已死/i],
 ['生活',/猫|发型|直发|造型|打理|化妆|小妆|美妆|颜值|鼻子|摩托|遥控车|高速|开关跳闸|魔术/i],
 ['健身健康',/引体|俯卧撑|双力臂|屈伸上|身体素质|驼背|焊锡.*危害|贴脚|三伏晒背/i],
 ['财经商业',/交易|券商|MiniQMT|量化|成交量|周期.*涨跌|接盘|有钱人|拼多多|淘宝|备用金|家族委员会|家庭托举|亏.*手表/i],
 ['自媒体',/群运营|搬运号|流量|自己品牌|求三连|直播神器/i],
 ['职场',/外卖|外企|远程|公积金|电子厂|企业|待业|空窗期|配不上的工作/i],
 ['历史社会',/伟人|领袖|工人|人民|美国|确权|无拐|宝贝回家|科工复合体/i],
 ['心理情感',/庄子|减法|必死|犹豫|遗憾|被甩|闲聊|浩然|来时路|挑拨|处世|沉默|控制欲|对等|透彻|祛魅|守弱|本质高手|阿伦森|见人说人话|硬刚|人间真实|道理|英雄救美|告白|刀在石上|见路不走/i],
 ['学习方法',/徐涛|做题|囚徒困境|回到起点|SOP化/i],
 ['写作小说',/比喻|修辞/i],
 ['游戏电竞',/影刃|无尽|大司命|狄仁杰|出装|铭文|孙权.*教学|魔法对轰/i]
);
for(const row of records){
 if(row.topic)continue;
 if(/已失效|已删除|视频不存在/.test(row.title))continue;
 const match=broader.find(([,re])=>re.test(row.title));
 const historic=match?null:broader.find(([,re])=>re.test((history.get(row.bvid)||[]).filter(t=>t!=='-').join('\n')));
 if(match||historic){row.topic=(match||historic)[0];row.reason=match?'按标题的主要用途选择最合适主分类':'同 BV 历史简介提供主要用途';row.confidence='medium';row.evidenceSource=match?'current_snapshot_title':'historical_description';}
 if(!row.topic&&/TripoAI/i.test(authors.get(row.bvid)||'')){row.topic='摄影设计';row.reason='同 BV 历史作者为 TripoAI，按 3D 创作工具倾向归类';row.confidence='low';row.evidenceSource='historical_author';}
}
// Similarity uses only already classified titles; never another inferred result.
const grams=text=>new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).flatMap(w=>w.length>1?Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2)):[]));
const seeds=records.filter(x=>x.topic).map(x=>({...x,grams:grams(x.title)}));
for(const row of records){
 if(row.topic)continue;
 if(!row.title||/已失效|已删除|视频不存在/.test(row.title)){
  row.topic='失效收藏';row.reason='原始标题不可用，按失效状态独立归档';row.confidence='low';
 }else{
  const g=grams(row.title);let best=null,score=0;
  for(const seed of seeds){let shared=0;for(const term of g)if(seed.grams.has(term))shared++;
   const similarity=shared/(g.size+seed.grams.size-shared||1);
   if(shared>=2&&similarity>score){score=similarity;best=seed;}
  }
  if(best&&score>=0.16){row.topic=best.topic;row.reason='与已归类标题词组相近，按倾向归类';row.similarBvid=best.bvid;row.similarity=Number(score.toFixed(3));row.confidence='low';}
  else{row.topic='综合收藏';row.reason='标题缺少主题线索，归入综合收藏便于检索';row.confidence='low';}
 }
 row.evidenceSource='local_title_best_fit';
}
for(const row of records){
 if(row.topic==='失效收藏')continue;
 const subject=primarySubjects.find(([,re])=>re.test(row.title));
 if(subject){row.topic=subject[0];row.reason='以标题明确说明的主要内容为准，忽略附带标签';row.confidence='medium';row.evidenceSource='explicit_title_subject';}
}
// Last-resort, explicitly low-confidence proposals under the user's best-fit policy.
// Use an immutable set of observed neighbours; inferred labels never train others.
const contextualSeeds=records.map(r=>r.topic!=='综合收藏'&&r.topic!=='失效收藏'&&r.confidence!=='low'?r.topic:null);
const peerTitles=new Map();
for(const item of inventory.members||[]){if(item.author){const list=peerTitles.get(item.author)||[];list.push(item);peerTitles.set(item.author,list);}}
for(let i=0;i<records.length;i++){
 const row=records[i];if(row.topic!=='综合收藏')continue;
 const author=authors.get(row.bvid);
 const peers=(peerTitles.get(author)||[]).filter(p=>p.bvid!==row.bvid);
 const peer=peers.map(p=>({row:p,subject:primarySubjects.find(([,re])=>re.test(p.title))})).find(p=>p.subject);
 if(peer){row.topic=peer.subject[0];row.reason='同作者其他已收藏视频的明确主题，仅作为倾向';row.evidenceSource='historical_author_peer';row.relatedBvid=peer.row.bvid;}
 else{
  const votes=new Map(),evidence=[];
  for(let distance=1;distance<=6;distance++)for(const index of [i-distance,i+distance]){
   const topic=contextualSeeds[index];if(!topic)continue;
   votes.set(topic,(votes.get(topic)||0)+1/distance);
   evidence.push({bvid:records[index].bvid,topic,distance});
  }
  const ranked=[...votes].sort((a,b)=>b[1]-a[1]);
  if(!ranked.length)throw Error('No contextual evidence for remaining record');
  row.topic=ranked[0][0];row.reason='标题信息不足，参考相邻收藏主题作低置信度归类；未核实视频内容';
  row.evidenceSource='collection_order_context';row.contextEvidence=evidence;
  row.candidates=ranked.map(([topic])=>topic);
 }
 row.confidence='low';row.contentVerified=false;row.optionalReview=true;
}
for(const row of records){row.targetFolder=TARGETS[row.topic]||row.topic;row.status=row.evidenceSource==='collection_order_context'||row.evidenceSource==='historical_author_peer'?'best_fit_low_confidence':'locally_classified';}
if(new Set(records.map(x=>x.bvid)).size!==records.length)throw Error('Duplicate BV');
const byTopic={};for(const row of records){const key=row.topic||'待内容复核';byTopic[key]=(byTopic[key]||0)+1;}
const output={version:1,generatedAt:new Date().toISOString(),sourceSnapshotAt:snapshot.captured_at,
 policy:'best_fit_primary_topic',classificationComplete:records.every(x=>x.topic&&x.topic!=='综合收藏'),
 summary:{total:records.length,classified:records.filter(x=>x.topic&&x.topic!=='综合收藏').length,needsContentReview:records.filter(x=>!x.topic||x.topic==='综合收藏').length,lowConfidence:records.filter(x=>x.confidence==='low').length,contextualBestFit:records.filter(x=>x.evidenceSource==='collection_order_context').length,byTopic},
 sourceShortfall:snapshot.shortfall,accountWrites:0,records};
const path=join(dir,'browser-live-reviewed-classification.json');
await writeFile(path+'.tmp',JSON.stringify(output,null,2),{mode:0o600});await rename(path+'.tmp',path);
console.log(JSON.stringify({path,summary:output.summary},null,2));
