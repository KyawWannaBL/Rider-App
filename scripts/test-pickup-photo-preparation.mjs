import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

// Runs real browser decoding/encoding; no camera, backend or account is used.
// --legacy demonstrates the original sub-8-MB bypass against the same fixture.
const legacy = process.argv.includes('--legacy');
const source = legacy
  ? execFileSync('git',['show','HEAD:src/pages/RiderPickupPhotoQrPortal.tsx'],{encoding:'utf8'})
  : readFileSync('src/lib/pickupPhotoPreparation.ts','utf8');
const moduleSource = legacy
  ? source.slice(source.indexOf('async function compressPickupPhoto('),source.indexOf('\nfunction readPhotoPreview('))+'\nexport const preparePickupPhoto=compressPickupPhoto;'
  : source;
const javascript = ts.transpileModule(moduleSource,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
const server = createServer((req,res) => {
  res.setHeader('Content-Type',req.url==='/helper.js'?'text/javascript':'text/html');
  res.end(req.url==='/helper.js'?javascript:'<!doctype html><title>Photo preparation test</title>');
});
await new Promise(resolve=>server.listen(4189,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4189/photo-preparation-test');
  await page.evaluate(async () => { window.preparePickupPhoto = (await import('/helper.js')).preparePickupPhoto; });
  const results = await page.evaluate(async (legacy) => {
    const check = (condition,message) => { if (!condition) throw new Error(message); };
    const canvas = document.createElement('canvas'); canvas.width=3000; canvas.height=2200;
    const ctx = canvas.getContext('2d'); const pixels=ctx.createImageData(canvas.width,canvas.height);
    let seed=1234567;
    for(let i=0;i<pixels.data.length;i+=4){ seed=(1664525*seed+1013904223)>>>0; pixels.data[i]=seed&255;pixels.data[i+1]=(seed>>>8)&255;pixels.data[i+2]=(seed>>>16)&255;pixels.data[i+3]=255; }
    ctx.putImageData(pixels,0,0);
    ctx.fillStyle='white'; ctx.fillRect(500,600,2000,1000);
    ctx.fillStyle='black'; ctx.font='bold 120px sans-serif'; ctx.fillText('PARCEL 001 - 2 KG',600,820);
    // A barcode-like label detail should retain strong black/white contrast.
    for(let x=600;x<2400;x+=30)ctx.fillRect(x,1000,15,400);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.98));
    const input=new File([blob],'parcel-label.jpg',{type:'image/jpeg'});
    canvas.width=canvas.height=0;
    check(input.size>3*1024*1024 && input.size<8*1024*1024,`Fixture must reproduce multi-MB sub-8-MB photos: ${input.size}`);
    const results=[];
    for(const fallback of [false,true]){
      if(fallback){window.Worker=undefined;window.createImageBitmap=undefined;window.OffscreenCanvas=undefined;}
      const output=await window.preparePickupPhoto(input);
      check(output.size<=1024*1024,`Prepared photo must be <= 1 MiB; got ${output.size} bytes from ${input.size}`);
      check(output.type==='image/jpeg','Output must be JPEG');
      const url=URL.createObjectURL(output); const image=new Image();
      try {
        await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
        check(Math.max(image.naturalWidth,image.naturalHeight)<=1600,'Maximum edge must be 1600');
        check(image.naturalWidth>=1000,'Parcel-label fixture should retain readable dimensions');
        check(Math.abs(image.naturalWidth/image.naturalHeight-3000/2200)<0.01,'Aspect ratio must be preserved');
        const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const context=c.getContext('2d');context.drawImage(image,0,0);
        const sample=(x,y)=>context.getImageData(Math.round(x*c.width/3000),Math.round(y*c.height/2200),1,1).data[0];
        check(sample(607,1100)<80 && sample(622,1100)>170,'Label bars must retain contrast');c.width=c.height=0;
        results.push({fallback,inputBytes:input.size,outputBytes:output.size,width:image.naturalWidth,height:image.naturalHeight});
      } finally {image.src='';URL.revokeObjectURL(url);}
    }
    if(!legacy){
      // Add a real EXIF orientation=6 tag to the camera JPEG. Chromium decodes
      // this as a portrait; preparation must not lose or apply it twice.
      const bytes=new Uint8Array(await input.arrayBuffer());
      const exif=new Uint8Array([0xff,0xe1,0x00,0x22,0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2a,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
      const oriented=new File([bytes.slice(0,2),exif,bytes.slice(2)],'portrait.jpg',{type:'image/jpeg'});
      const portrait=await window.preparePickupPhoto(oriented);const portraitUrl=URL.createObjectURL(portrait);const portraitImage=new Image();
      try{await new Promise((resolve,reject)=>{portraitImage.onload=resolve;portraitImage.onerror=reject;portraitImage.src=portraitUrl;});check(portraitImage.naturalHeight===1600 && portraitImage.naturalWidth===1173,'Platform-supported EXIF portrait orientation must be retained');}finally{portraitImage.src='';URL.revokeObjectURL(portraitUrl);}
      const rejects=async(file,options,pattern)=>{try{await window.preparePickupPhoto(file,options);}catch(error){check(pattern.test(error.message)||pattern.test(error.name),`Unexpected failure: ${error}`);return;}throw new Error('Expected preparation to reject');};
      await rejects(new File(['bad'],'bad.jpg',{type:'image/jpeg'}),undefined,/decode|image|photo/i);
      await rejects(new File(['text'],'bad.txt',{type:'text/plain'}),undefined,/image/i);
      await rejects(new File([new Uint8Array(14*1024*1024+1)],'oversize.jpg',{type:'image/jpeg'}),undefined,/large|14/i);
      const controller=new AbortController();controller.abort();await rejects(input,{signal:controller.signal},/Abort/i);
      const during=new AbortController();const pending=window.preparePickupPhoto(input,{signal:during.signal});during.abort();await rejectsResult(pending);
      async function rejectsResult(promise){try{await promise;}catch(error){check(error.name==='AbortError','Cancellation must reject with AbortError');return;}throw new Error('Cancelled preparation must reject');}
      // An encoder returning an unbounded result must never return the original.
      const toBlob=HTMLCanvasElement.prototype.toBlob;
      try{HTMLCanvasElement.prototype.toBlob=function(callback){callback(new Blob([new Uint8Array(1024*1024+1)],{type:'image/jpeg'}));};await rejects(input,undefined,/large|compress|size|limit/i);}finally{HTMLCanvasElement.prototype.toBlob=toBlob;}
      try{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};await rejects(input,undefined,/compress/i);}finally{HTMLCanvasElement.prototype.toBlob=toBlob;}
      // Every decode URL must be revoked on both success and failure.
      const create=URL.createObjectURL,revoke=URL.revokeObjectURL;const active=new Set();
      URL.createObjectURL=function(blob){const url=create.call(URL,blob);active.add(url);return url;};URL.revokeObjectURL=function(url){active.delete(url);return revoke.call(URL,url);};
      try{await window.preparePickupPhoto(input);await rejects(new File(['bad'],'bad.jpg',{type:'image/jpeg'}),undefined,/decode|image|photo/i);check(active.size===0,'Preparation must release all decode object URLs');}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
    }
    return results;
  },legacy);
  assert.equal(results.length,2);
  console.log('PASS bounded pickup photos: real multi-MB JPEG, label detail, legacy WebView fallback, invalid input, size limit, cancellation and URL cleanup',results);
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
