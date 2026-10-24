import {readFile,writeFile,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const capture=JSON.parse(await readFile(join(dir,'browser-live-capture.json'),'utf8'));
const pages=Object.entries(capture.pages||{}).map(([page,value])=>({page:Number(page),items:value.items||[]})).sort((a,b)=>a.page-b.page);
const members=pages.flatMap(({page,items})=>items.map(item=>({
 folder_id:721267304,
 folder_title:'默认收藏夹',
 bvid:item.bvid,
 title:item.title,
 source_page:page,
 source:'authorized_browser_readback'
})));
const unique=[...new Map(members.map(item=>[item.bvid,item])).values()];
const output={
 version:1,
 source:'authorized_browser_readback',
 captured_at:capture.capturedAt||new Date().toISOString(),
 reported_total:4736,
 reported_pages:119,
 observed_pages:pages.length,
 observed_memberships:members.length,
 distinct_bvids:unique.length,
 shortfall:Math.max(0,4736-unique.length),
 complete:false,
 note:'Browser-rendered default-folder records only; page total exceeds rendered records and requires separate reconciliation.',
 pages,
 members:unique
};
const path=join(dir,'browser-live-snapshot.json');
const tmp=path+'.'+process.pid+'.tmp';
await writeFile(tmp,JSON.stringify(output,null,2),{mode:0o600});
await rename(tmp,path);
console.log(JSON.stringify({path,reportedTotal:output.reported_total,observedPages:output.observed_pages,observedMembers:output.observed_memberships,distinctBvids:output.distinct_bvids,shortfall:output.shortfall},null,2));
