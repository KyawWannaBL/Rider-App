import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright-core';

const server=await createServer({configFile:false,optimizeDeps:{entries:['tests/browser/index.html']},plugins:[react()],resolve:{alias:[
  {find:'@/lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
  {find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},
  {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:4191,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII=','base64');
try {
  const page=await browser.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await page.route('https://api.qrserver.com/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.route('https://fixture-proof.test/**',route=>route.fulfill({contentType:'image/png',body:png}));
  await page.goto('http://127.0.0.1:4191/tests/browser/index.html?recovery=1');
  const first=page.locator('[data-parcel-line="1"]');
  const second=page.locator('[data-parcel-line="2"]');
  await first.waitFor();
  const firstPreview=first.getByAltText(/^Cargo parcel /);
  await first.locator('input[type=file]').nth(1).setInputFiles({name:'original.png',mimeType:'image/png',buffer:png});
  await first.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();
  const originalSrc=await firstPreview.getAttribute('src');
  assert.ok(originalSrc?.startsWith('blob:'));
  async function failNextLineOneWrite(){
    await page.evaluate(()=>{
      const put=IDBObjectStore.prototype.put;
      window.__draftFailureObserved=false;
      IDBObjectStore.prototype.put=function(value,...args){
        if(this.name==='parcels' && value.lineNo===1){
          IDBObjectStore.prototype.put=put;
          window.__draftFailureObserved=true;
          throw new DOMException('Test: local disk full','QuotaExceededError');
        }
        return put.call(this,value,...args);
      };
    });
  }
  await failNextLineOneWrite();
  await first.locator('input[type=file]').nth(1).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>window.__draftFailureObserved);
  await page.getByRole('alert').filter({hasText:/draft storage|recovery|backup/i}).waitFor();
  assert.equal(await firstPreview.getAttribute('src'),originalSrc,'failed replacement retains the existing preview');
  assert.equal(await firstPreview.evaluate(async img=>{
    try {const response=await fetch(img.src);return response.ok && (await response.blob()).size>0;}
    catch{return false;}
  }),true,'existing preview Blob URL must remain usable after failed replacement');
  console.log('PASS quota failure while replacing a photo preserves the working original preview');

  // Clear the photo failure first, so the next failure is specifically a metadata edit.
  await page.getByRole('button',{name:'Retry draft backup',exact:true}).click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=alert]')).some(el=>/draft storage|recovery|backup/i.test(el.textContent||'')));
  await failNextLineOneWrite();
  await first.locator('textarea').fill('latest line one remarks');
  await page.waitForFunction(()=>window.__draftFailureObserved);
  const warning=page.getByRole('alert').filter({hasText:/draft storage|recovery|backup/i});
  await warning.waitFor();
  await second.locator('textarea').fill('line two committed');
  // Read through the same helper queue so assertion occurs after line two's commit.
  assert.equal(await page.evaluate(async()=>{
    const {loadPickupDrafts}=await import('/src/lib/pickupDraftStore.ts');
    const session=await import('/tests/browser/mockSupabase.ts');
    const {data}=await session.supabase.auth.getSession();
    const rows=await loadPickupDrafts(data.session.user.id,'P1019-TST-001');
    return rows.find(row=>row.line_no===2)?.remarks;
  }),'line two committed');
  assert.equal(await warning.count(),1,'a successful unrelated row cannot clear the failed line warning');
  await page.getByRole('button',{name:'Retry draft backup',exact:true}).click();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=alert]')).some(el=>/draft storage|recovery|backup/i.test(el.textContent||'')));
  await page.reload();
  await first.waitFor();
  assert.equal(await first.locator('textarea').inputValue(),'latest line one remarks','explicit backup retry commits the latest failed edit');
  assert.equal(await second.locator('textarea').inputValue(),'line two committed');
  assert.equal(await firstPreview.evaluate(async img=>{
    const response=await fetch(img.src);return response.ok && (await response.blob()).size>0;
  }),true,'original evidence survives reload after retry');
  assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),0,'draft retries cannot upload photos or create parcel records');
  assert.equal(await page.evaluate(()=>window.__photoFixture.saveCalls.length),0);
  console.log('PASS failed metadata stays warned after unrelated commit; explicit retry restores latest edits after reload');
} finally {
  await browser.close();
  await server.close();
}
