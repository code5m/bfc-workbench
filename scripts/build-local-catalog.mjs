import {homedir} from 'node:os';
import {join} from 'node:path';
import {buildLocalCatalogFromDir,saveLocalCatalog} from '../lib/local-catalog.mjs';
const dir=process.env.BILIBILI_FAVORITES_DATA_DIR||join(homedir(),'Documents','Bilibili-Favorites-Review');
const c=await buildLocalCatalogFromDir(dir);
const file=await saveLocalCatalog(dir,c);
console.log(JSON.stringify({path:file,totals:c.totals,topics:c.categories.length,folders:c.folders.length},null,2));
