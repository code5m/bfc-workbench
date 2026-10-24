const base=process.env.SELF_CURATED_BASE_URL||'http://127.0.0.1:4198';
const checks=[];
async function request(path,options){const response=await fetch(base+path,options);let body=null;try{body=await response.json()}catch{}return {response,body};}
function check(name,pass,detail){checks.push({name,pass,detail});}
const health=await request('/api/health');check('health',health.response.ok,health.body);
const session=await request('/api/session');check('session',session.response.ok,session.body?.ownerId||'missing');
const token=session.body?.token;
const state=await request('/api/workbench/state',{headers:{'X-Local-CSRF':token||''}});check('authorized-state',state.response.ok, state.body?.summary||state.body);
const unauth=await request('/api/workbench/state');check('unauthorized-state-rejected',unauth.response.status===403,unauth.response.status);
const diff=await request('/api/workbench/diff',{headers:{'X-Local-CSRF':token||''}});check('diff',diff.response.ok,diff.body?.diff&&{reported:diff.body.diff.reportedTotal,read:diff.body.diff.readCardCount,gap:diff.body.diff.unexplainedGap,status:diff.body.diff.completeness});
const capabilities=await request('/api/capabilities');check('capabilities',capabilities.response.ok,capabilities.body?.platforms);
const videoCount=state.body?.summary?.videoCount||0;check('video-baseline',videoCount===4669,videoCount);
const passed=checks.every(item=>item.pass);console.log(JSON.stringify({base,passed,checks},null,2));process.exitCode=passed?0:1;
