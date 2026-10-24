export function buildStarterTopics(rows){
 const recipes=[
  {id:'english-pronunciation',name:'英语发音入门',description:'从音标和单词发音，到连读弱读，再到日常口语跟练。',match:/音标|发音|连读|弱读|口语|美音|英音|元音|辅音|词根/,stages:[['发音基础',/音标|元音|辅音|单词|词根/],['连读与语调',/连读|弱读|语调|重音/],['口语跟练',/.*/]]},
  {id:'ai-coding',name:'AI 编程实战',description:'配置工具、掌握协作方式，再做一个实际项目。顺序是初步编排，可自行调整。',match:/AI编程|Codex|Claude Code|Cursor|CodeBuddy|Trae|代码.*AI|AI.*代码/i,stages:[['工具准备',/安装|配置|登录|入门|教程/],['协作方法',/skill|提示|工作流|工程|规范/i],['项目实践',/.*/]]},
  {id:'billiards',name:'台球基本功',description:'先练站位、手架和出杆，再学瞄准、杆法与走位。',match:/台球|桌球|手架|出杆|加塞|贴库|翻袋|瞄准|中袋|低杆|高杆/,stages:[['姿势与出杆',/站位|手架|出杆|姿势|基本/],['瞄准与进球',/瞄准|准度|进球|角度/],['杆法与走位',/.*/]]}
 ];
 return recipes.map(recipe=>{
  const sections={},grouped=recipe.stages.map(()=>[]);
  for(const row of rows.filter(r=>r.topic!=='失效收藏'&&recipe.match.test(r.title)&&(recipe.id!=='english-pronunciation'||r.topic==='英语')&&(recipe.id!=='billiards'||r.topic==='体育'))){const i=recipe.stages.findIndex(([,re])=>re.test(row.title));grouped[i].push(row.bvid);sections[row.bvid]=recipe.stages[i][0];}
  return {id:recipe.id,name:recipe.name,description:recipe.description,chapters:recipe.stages.map(([name])=>name),items:grouped.flat(),sections};
 });
}
