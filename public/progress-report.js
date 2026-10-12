
async function refreshProgressReport(){
 try{
  const r=await fetch('/api/progress-report',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json(),out=$('progress-current');out.replaceChildren();
  for(const [name,num] of [['已保存视频',d.current.unique],['原分类建议',d.current.proposed],['本地AI辅助复核',d.current.assisted],['仍需复核',d.current.review],['失效待处置',d.current.invalid],['未扫完目录',d.current.unscanned]]){
   const c=elem(out,'div'),lab=elem(c,'span',name);elem(c,'strong',String(num));
  }
  $('progress-diff').textContent=d.baselineAvailable?
   '较上轮变化：'+Object.entries(d.delta).map(([k,v])=>k+' '+(v>0?'+':'')+v).join(' · '):
   '首次生成进度基线；后续数据变化会记录增量';
  $('progress-waiting').textContent='未完整目录：'+d.waitingOnExternalData.map(x=>x.name).join('、')+' · B站同步未完成';
 }catch(e){$('progress-diff').textContent='进度报告生成失败：'+String(e);}
}
$('progress-refresh').onclick=refreshProgressReport;
refreshProgressReport();
