import fs from 'node:fs';
import path from 'node:path';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const target=process.argv[2];const folder=process.argv[3];fs.mkdirSync(folder,{recursive:true});
const doc=await getDocument({data:new Uint8Array(fs.readFileSync(target)),useSystemFonts:true}).promise;
let sheet,ctx;const scale=.9;const cw=550,ch=780;
for(let n=1;n<=doc.numPages;n++){
 const page=await doc.getPage(n);const vp=page.getViewport({scale:1.2});const c=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
 fs.writeFileSync(path.join(folder,`page-${n}.png`),c.toBuffer('image/png'));
 if((n-1)%9===0){sheet=createCanvas(cw*3,ch*3);ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,cw*3,ch*3);}
 const k=(n-1)%9;ctx.drawImage(c,(k%3)*cw,Math.floor(k/3)*ch,cw,ch-20);ctx.fillStyle='black';ctx.font='12px Arial';ctx.fillText(`Page ${n}`,(k%3)*cw+10,Math.floor(k/3)*ch+ch-5);
 if(n%9===0||n===doc.numPages)fs.writeFileSync(path.join(folder,`sheet-${Math.ceil(n/9)}.png`),sheet.toBuffer('image/png'));
}
console.log(JSON.stringify({target,pages:doc.numPages,folder}));
