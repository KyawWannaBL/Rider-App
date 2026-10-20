import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright-core';

// No service connections: this exercises the real browser's IndexedDB only.
const server = await createServer({configFile:false,optimizeDeps:{noDiscovery:true},plugins:[{name:'draft-test-page',configureServer(server){server.middlewares.use('/draft-store-test',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Draft store test</title>');});}}],server:{host:'127.0.0.1',port:4189,strictPort:true}});
await server.listen();
const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4189/draft-store-test');
  async function run(fn) { return page.evaluate(fn); }
  assert.equal(await run(async()=>{
    const {savePickupDrafts}=await import('/src/lib/pickupDraftStore.ts');
    const rows=Array.from({length:99},(_,i)=>({line_no:i+1,waybill_no:`W${i}`,delivery_way_id:`D${i}`,temp_qr_code:`T${i}`,parcel_weight:i%2?'4':'2',remarks:`parcel ${i}`,draft_revision:3,cargo_photo_file:new File([`photo ${i}`],`photo-${i}.jpg`,{type:'image/jpeg',lastModified:1234+i}),cargo_photo_data_url:'data:image/jpeg;base64,excluded',cargo_photo_url:'',secret:'excluded'}));
    await savePickupDrafts('user-a','pickup-a',rows);
    return true;
  }),true);
  await page.reload();
  const restored = await run(async()=>{
    const {loadPickupDrafts}=await import('/src/lib/pickupDraftStore.ts');
    const rows=await loadPickupDrafts('user-a','pickup-a');
    return Promise.all(rows.map(async row=>({line:row.line_no,weight:row.parcel_weight,remarks:row.remarks,name:row.cargo_photo_file.name,lastModified:row.cargo_photo_file.lastModified,type:row.cargo_photo_file.type,body:await row.cargo_photo_file.text(),preview:row.cargo_photo_data_url,secret:row.secret})));
  });
  assert.equal(restored.length,99);
  restored.forEach((row,i)=>assert.deepEqual(row,{line:i+1,weight:i%2?'4':'2',remarks:`parcel ${i}`,name:`photo-${i}.jpg`,lastModified:1234+i,type:'image/jpeg',body:`photo ${i}`,preview:undefined,secret:undefined}));
  console.log('PASS 99 mixed-weight photos survive hard reload with File metadata');
  assert.deepEqual(await run(async()=>{
    const {loadPickupDrafts,savePickupDrafts,removePickupDraft,clearPickupDrafts,upsertPickupDrafts}=await import('/src/lib/pickupDraftStore.ts');
    await savePickupDrafts('user-b','pickup-a',[{line_no:1,remarks:'other user'}]);
    await savePickupDrafts('user-a','pickup-b',[{line_no:1,remarks:'other pickup'}]);
    const first=savePickupDrafts('user-a','pickup-a',[{line_no:1,remarks:'old'}]);
    const second=savePickupDrafts('user-a','pickup-a',[{line_no:1,remarks:'new'},{line_no:2,remarks:'delete'}]);
    await Promise.all([first,second]);
    await upsertPickupDrafts('user-a','pickup-a',[{line_no:1,remarks:'new',parcel_weight:'4'}]);
    if ((await loadPickupDrafts('user-a','pickup-a')).length !== 2) throw new Error('upsert removed an unrelated line');
    await removePickupDraft('user-a','pickup-a',2);
    const result=[(await loadPickupDrafts('user-a','pickup-a'))[0].remarks,(await loadPickupDrafts('user-b','pickup-a'))[0].remarks,(await loadPickupDrafts('user-a','pickup-b'))[0].remarks];
    await clearPickupDrafts('user-a','pickup-a');
    result.push(String((await loadPickupDrafts('user-a','pickup-a')).length));
    result.push((await loadPickupDrafts('user-b','pickup-a'))[0].remarks);
    return result;
  }),['new','other user','other pickup','0','other user']);
  console.log('PASS ordered writes, row deletion and user/pickup isolation');
  assert.deepEqual(await run(async()=>{
    const {loadPickupDrafts,savePickupDrafts}=await import('/src/lib/pickupDraftStore.ts');
    await savePickupDrafts('user-a','failure',[{line_no:1,remarks:'committed'}]);
    const original=IDBObjectStore.prototype.put;
    let error='';
    IDBObjectStore.prototype.put=function(){throw new DOMException('disk full','QuotaExceededError');};
    try { await savePickupDrafts('user-a','failure',[{line_no:1,remarks:'lost'}]); } catch(e) { error=e.message; }
    finally { IDBObjectStore.prototype.put=original; }
    const previous=(await loadPickupDrafts('user-a','failure'))[0].remarks;
    await savePickupDrafts('user-a','failure',[{line_no:1,remarks:'retry',cargo_photo_url:'blob:excluded',reviewed_photo_url:'data:image/png;base64,excluded',saved:true,cargo_photo_path:'pickup/remote.jpg'}]);
    const row=(await loadPickupDrafts('user-a','failure'))[0];
    return [previous,/draft|storage/i.test(error),row.cargo_photo_url,row.reviewed_photo_url,row.cargo_photo_path,row.saved];
  }),['committed',true,undefined,undefined,'pickup/remote.jpg',true]);
  console.log('PASS failed transaction keeps previous committed snapshot and retry works; previews excluded');
  assert.deepEqual(await run(async()=>{
    const {savePickupDrafts,loadPickupDrafts,removePickupDraft}=await import('/src/lib/pickupDraftStore.ts');
    let invalid=false;
    try { await removePickupDraft('user-a','failure',undefined); } catch { invalid=true; }
    const previous=(await loadPickupDrafts('user-a','failure')).length;
    const original=window.indexedDB;
    let unavailable=false;
    Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
    try { await savePickupDrafts('user-a','failure',[{line_no:1}]); } catch(e) { unavailable=/storage failed/.test(e.message); }
    finally { Object.defineProperty(window,'indexedDB',{configurable:true,value:original}); }
    return [invalid,previous,unavailable,(await loadPickupDrafts('user-a','failure')).length];
  }),[true,1,true,1]);
  console.log('PASS unavailable storage rejects and invalid row deletion cannot erase a draft');
} finally {
  await browser.close();
  await server.close();
}
