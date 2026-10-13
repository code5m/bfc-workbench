// No DOM insertion, DOMParser, element fetching, network or script evaluation.
// These functions treat a saved webpage as inert TEXT.
const validBvid=/^BV[0-9A-Za-z]{10}$/;
const MAX_RESULTS=201; // One above the server's 200-item batch limit: no silent truncation.

function decodeEntities(input){
 return String(input||'').replace(/&(?:amp|quot|apos|lt|gt|#([0-9]+)|#x([0-9a-f]+));/gi,(all,dec,hex)=>{
  if(dec!==undefined){const n=Number(dec);return n>=32&&n<=0x10ffff?String.fromCodePoint(n):'';}
  if(hex!==undefined){const n=parseInt(hex,16);return n>=32&&n<=0x10ffff?String.fromCodePoint(n):'';}
  return ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'})[all.toLowerCase()]||all;
 });
}
function plainText(raw){
 return decodeEntities(String(raw||'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/\s+/g,' ').trim()).slice(0,240);
}
function attribute(raw,key){
 const safeKey=key.replace(/[^a-z-]/g,'');
 const match=new RegExp('(?:^|\\s)'+safeKey+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i').exec(raw);
 return match?decodeEntities(match[1]??match[2]??match[3]??''):'';
}
function keep(found,bvid,title){
 if(!validBvid.test(bvid))return;
 const candidate=plainText(title)||bvid;
 const current=found.get(bvid);
 if(!current||current.title===bvid&&candidate!==bvid)found.set(bvid,{bvid,title:candidate});
}
export function extractSavedHtmlVideos(html){
 const found=new Map();
 const matcher=/<a\b([^>]{0,3000})>([\s\S]{0,5000}?)<\/a\s*>/gi;
 let matched;
 while((matched=matcher.exec(html))!==null&&found.size<MAX_RESULTS){
  const attrs=matched[1],href=attribute(attrs,'href');
  if(!href)continue;
  let url;
  try{url=new URL(href,'https://www.bilibili.com');}catch{continue;}
  if(!['www.bilibili.com','m.bilibili.com'].includes(url.hostname))continue;
  const bvidMatch=/\/video\/(BV[0-9A-Za-z]{10})(?:\/|$)/.exec(url.pathname);
  if(!bvidMatch)continue;
  const inner=matched[2];
  const img=/<img\b([^>]*)>/i.exec(inner);
  const title=attribute(attrs,'title')||attribute(attrs,'aria-label')||
   attribute(attrs,'data-title')||(img?attribute(img[1],'alt'):'')||plainText(inner);
  keep(found,bvidMatch[1],title);
 }
 return [...found.values()];
}
export function extractSavedJsonVideos(raw){
 const root=typeof raw==='string'?JSON.parse(raw):raw;
 const found=new Map();
 let visited=0;
 function scan(node,depth){
  if(visited++>15000||depth>12||found.size>=MAX_RESULTS||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const row of node)scan(row,depth+1);return;}
  const bvid=node.bvid||node.bv_id||node.bvId;
  if(typeof bvid==='string')keep(found,bvid,node.title||node.name||bvid);
  // Explicit collection-shaped keys only; never traverse cookie/token fields.
  for(const k of ['data','medias','items','members','entries','videos','list','results','records']){
   if(Object.hasOwn(node,k))scan(node[k],depth+1);
  }
 }
 scan(root,0);
 return [...found.values()];
}
