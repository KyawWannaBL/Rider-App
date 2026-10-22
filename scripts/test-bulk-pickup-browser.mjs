import {uniquePhoto} from './fixtures/unique-photo.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright-core';

const server=await createServer({configFile:false,plugins:[react()],resolve:{alias:[
  {find:'@/lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
  {find:'../lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
  {find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},
  {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:4178,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII=','base64');
try {
  for(const role of ['rider','driver','helper']){
    const page=await browser.newPage();
    await page.route('https://api.qrserver.com/**',r=>r.fulfill({contentType:'image/png',body:png}));
    await page.goto(`http://127.0.0.1:4178/tests/browser/index.html?role=${role}&native=1`);
    await page.locator('[data-parcel-line="1"]').waitFor();
    assert.equal(await page.locator('input[type=file][multiple]').count(),0,'APK bulk selection must bypass the WebView file chooser');
    const pick=page.getByRole('button',{name:'Select Multiple Photos',exact:true});
    await pick.click();
    assert.equal(await page.evaluate(()=>window.__nativePhotoFixture.context.pickupId),'P1019-TST-001');
    assert.deepEqual(await page.evaluate(()=>window.__nativePhotoFixture.context.lineNos),[1,2]);
    await page.evaluate(()=>window.__nativePhotoFixture.bulkPending([new File(['first'],'first.jpg',{type:'image/jpeg'}),new File(['second'],'second.jpg',{type:'image/jpeg'})]));
    await page.getByText('Staged 2 photos in parcel order.',{exact:false}).waitFor();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),0,'bulk selection must await review');
    await page.getByRole('button',{name:'Approve & Upload All Photos',exact:true}).click();
    await page.getByText('Photo upload completed: 2/2',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    assert.equal(await page.getByText('Photo uploaded successfully',{exact:true}).count(),2,'refresh must retain both uploads');
    await page.getByRole('button',{name:'Approve & Upload All Photos',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),2,'bulk retry must not duplicate uploads');
    console.log(`PASS ${role}: native bulk selection, parcel order, staged review, upload and refresh`);
    await page.close();
  }
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4178/tests/browser/index.html?native=1');
  await page.locator('[data-parcel-line="1"]').waitFor();
  await page.evaluate(()=>{
    window.__nativePhotoFixture.restored={context:{kind:'pickup-bulk',pickupId:'P1019-TST-001',lineNos:[1,2]},files:[new File(['one'],'one.jpg',{type:'image/jpeg'}),new File(['two'],'two.jpg',{type:'image/jpeg'})]};
    window.dispatchEvent(new Event('britium:native-photo-restored'));
  });
  await page.getByText('Staged 2 photos in parcel order.',{exact:false}).waitFor();
  console.log('PASS restored bulk photos attach to the original pickup after activity recreation');
  await page.close();
  const race=await browser.newPage();
  await race.goto('http://127.0.0.1:4178/tests/browser/index.html?native=1');
  await race.locator('[data-parcel-line="1"]').waitFor();
  await race.locator('select').first().selectOption('P1019-ALT-001');
  await race.waitForFunction(()=>window.__photoFixture.snapshotRequests.length===2);
  await race.locator('select').first().selectOption('P1019-TST-001');
  await race.waitForFunction(()=>window.__photoFixture.snapshotRequests.length===3);
  await race.evaluate(()=>{
    window.__photoFixture.snapshotDelay=200;
    window.__nativePhotoFixture.restored={context:{kind:'pickup-bulk',pickupId:'P1019-TST-001',lineNos:[1,2]},files:[new File(['one'],'wrong-pickup-one.jpg',{type:'image/jpeg'}),new File(['two'],'wrong-pickup-two.jpg',{type:'image/jpeg'})]};
    window.dispatchEvent(new Event('britium:native-photo-restored'));
  });
  await race.waitForFunction(()=>window.__photoFixture.snapshotRequests.length===4);
  await race.locator('select').first().selectOption('P1019-ALT-001');
  await race.waitForTimeout(500);
  assert.equal(await race.getByText('Photo: wrong-pickup-one.jpg',{exact:true}).count(),0,'restored photos must not attach after switching pickup during recovery');
  assert.equal(await race.getByText('Photo: wrong-pickup-two.jpg',{exact:true}).count(),0);
  console.log('PASS switching pickup during restore never attaches recovered evidence to another pickup');
  await race.close();
  const partial=await browser.newPage();
  await partial.goto('http://127.0.0.1:4178/tests/browser/index.html');
  await partial.locator('[data-parcel-line="1"]').waitFor();
  const input=partial.locator('input[type=file][multiple]');
  await input.setInputFiles([{name:'first.png',mimeType:'image/png',buffer:png},{name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')}]);
  await partial.getByText('No photos from this batch were staged.',{exact:false}).waitFor();
  assert.equal(await partial.getByText('Photo: first.jpg',{exact:true}).count(),0,'a later invalid file must not strand the first parcel');
  await input.setInputFiles([{name:'first.png',mimeType:'image/png',buffer:png},{name:'second.png',mimeType:'image/png',buffer:uniquePhoto('second')}]);
  await partial.getByText('Staged 2 photos in parcel order.',{exact:false}).waitFor();
  console.log('PASS preparation failure leaves the whole batch retryable without occupied parcel slots');
  await partial.close();
  const busy=await browser.newPage();
  await busy.goto('http://127.0.0.1:4178/tests/browser/index.html?native=1');
  const first=busy.locator('[data-parcel-line="1"]');
  await first.waitFor();
  await first.locator('input[type=file]').nth(1).setInputFiles({name:'first.png',mimeType:'image/png',buffer:png});
  await first.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();
  await busy.evaluate(()=>window.__photoFixture.uploadDelay=500);
  await first.getByRole('button',{name:'Approve Photo & Upload',exact:true}).click();
  await busy.evaluate(()=>{
    window.__nativePhotoFixture.restored={context:{kind:'pickup-bulk',pickupId:'P1019-TST-001',lineNos:[2]},files:[new File(['recovered'],'after-busy.jpg',{type:'image/jpeg'})]};
    window.dispatchEvent(new Event('britium:native-photo-restored'));
  });
  await busy.getByText('Photo: after-busy.jpg',{exact:true}).waitFor();
  console.log('PASS a recovered batch automatically resumes after another photo operation finishes');
  await busy.close();
}finally{await browser.close();await server.close();}
