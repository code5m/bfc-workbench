import {createHash} from 'node:crypto';
import {readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const FILE='saved-page-import-staging.json';
const BV=/^BV[0-9A-Za-z]{10}$/;
const FORMATS=new Set(['saved_html','saved_json']);
const cleanText=(value,limit)=>
 String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function validateSavedPageInput(input,validFolders){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_import');
 const folder=cleanText(input.folder,100);
 if(!validFolders.includes(folder))throw Error('unknown_source_folder');
 if(!FORMATS.has(input.format))throw Error('unsupported_import_format');
 if(!Array.isArray(input.entries)||input.entries.length===0||input.entries.length>200)
  throw Error('invalid_import_item_count');
 const titleSet=new Map();
 for(const row of input.entries){
  if(typeof row!=='object'||row===null||!BV.test(row.bvid))throw Error('invalid_import_bvid');
  const title=cleanText(row.title,240)||row.bvid;
  const existing=titleSet.get(row.bvid);
  if(!existing||title!==row.bvid&&existing===row.bvid)titleSet.set(row.bvid,title);
 }
 const entries=Array.from(titleSet,([bvid,title])=>({bvid,title})).sort((a,b)=>a.bvid.localeCompare(b.bvid));
 const sourceName=cleanText(input.sourceName,100).replace(/[/\\]/g,'_')||'用户保存的网页';
 const hash=fingerprint([folder,entries]);
 return {folder,entries,format:input.format,sourceName,hash};
}
export function initialSavedPageStore(){
 return {schemaVersion:1,batches:[],items:[]};
}
export function applySavedPageImport(store,validated,when){
 if(store?.schemaVersion!==1||!Array.isArray(store.items)||!Array.isArray(store.batches))
  throw Error('invalid_import_store');
 if(store.batches.some(x=>x.hash===validated.hash))
  return {store,imported:0,alreadyImported:true,uniqueItems:store.items.length};
 if(store.batches.length>=1000)throw Error('import_batch_limit_reached');
 const existing=new Map(store.items.map(x=>[x.bvid,{...x,observations:[...(x.observations||[])]}]));
 let added=0;
 for(const item of validated.entries){
  const row=existing.get(item.bvid)||{
   bvid:item.bvid,title:item.title,firstImportedAt:when,observations:[]
  };
  if(!existing.has(item.bvid)){existing.set(item.bvid,row);added++;}
  if(row.title===row.bvid&&item.title!==item.bvid)row.title=item.title;
  row.observations.push({
   folder:validated.folder,sourceName:validated.sourceName,
   format:validated.format,importedAt:when,batchHash:validated.hash
  });
 }
 const result={
  schemaVersion:1,
  batches:[...store.batches,{
   hash:validated.hash,folder:validated.folder,format:validated.format,
   sourceName:validated.sourceName,importedAt:when,items:validated.entries.length
  }],
  items:Array.from(existing.values()).sort((a,b)=>a.bvid.localeCompare(b.bvid))
 };
 return {store:result,imported:added,alreadyImported:false,uniqueItems:result.items.length};
}
export function summarizeSavedPageStore(store,observedMembers=[]){
 const known=new Set(observedMembers.map(x=>x.bvid));
 const items=store?.items||[];
 const folders={};
 for(const row of items){
  for(const folder of new Set((row.observations||[]).map(x=>x.folder))){
   folders[folder]=(folders[folder]||0)+1;
  }
 }
 return {
  stagedUnique:items.length,alreadyInSnapshot:items.filter(x=>known.has(x.bvid)).length,
  notInSnapshot:items.filter(x=>!known.has(x.bvid)).length,
  savedPages:store?.batches?.length||0,folders,
  safeToSync:false,remoteRequests:0,accountWrites:0,verifiedAccountSync:0,
  status:'OFFLINE_STAGING_NOT_VERIFIED'
 };
}
export async function loadSavedPageStore(dir){
 try{
  const raw=JSON.parse(await readFile(join(dir,FILE),'utf8'));
  if(raw.schemaVersion!==1||!Array.isArray(raw.items)||!Array.isArray(raw.batches))
   throw Error('invalid_import_store');
  return raw;
 }catch(e){
  if(e.code==='ENOENT')return initialSavedPageStore();
  throw e;
 }
}
export async function saveSavedPageStore(dir,store){
 const path=join(dir,FILE),temp=path+'.'+process.pid+'.tmp';
 try{
  await writeFile(temp,JSON.stringify(store,null,2),{mode:0o600,flag:'wx'});
  await rename(temp,path);
 }finally{await unlink(temp).catch(()=>{});}
}
