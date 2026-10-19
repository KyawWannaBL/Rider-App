import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright-core';

// Set BROWSER_EXECUTABLE_PATH when the Playwright-managed browser is unavailable.
const server=await createServer({configFile:false,optimizeDeps:{entries:['tests/browser/index.html']},plugins:[react()],resolve:{alias:[
  {find:'../lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
  {find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},
  {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:4177,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII=','base64');
try {
  for(const role of ['rider','driver','helper']){
    const page=await browser.newPage();
    page.on("dialog",dialog=>dialog.accept());
    await page.route('https://api.qrserver.com/**',route=>route.fulfill({contentType:'image/png',body:png}));
    await page.goto(`http://127.0.0.1:4177/tests/browser/index.html?role=${role}`);
    const first=page.locator('[data-parcel-line="1"]'), second=page.locator('[data-parcel-line="2"]');
    await first.waitFor();
    for(const [i,card] of [first,second].entries()){
      await card.locator('input[type=file]').nth(1).setInputFiles({name:`proof-${i}.png`,mimeType:'image/png',buffer:png});
      await card.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();
      await card.locator('input[inputmode=decimal]').fill('2');
    }
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),0,'selection must stage before approval');
    await page.evaluate(()=>window.__photoFixture.saveDelay=120);
    await first.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
    assert.equal(await second.locator('input[inputmode=decimal]').isDisabled(),true,'save locks edits until completion');
    await first.getByText('Saved',{exact:true}).waitFor();
    assert.equal(await second.locator('img').first().getAttribute('src')?.then(x=>Boolean(x)),true,'other preview retained');
    await page.evaluate(()=>window.__photoFixture.uploadDelay=120);
    await second.getByRole('button',{name:'Approve Photo & Upload',exact:true}).click();
    assert.equal(await first.locator('input[type=file]').first().isDisabled(),true,'upload cannot reopen other photo controls');
    assert.equal(await page.locator('input[type=file][multiple]').isDisabled(),true,'bulk selection is locked during individual upload');
    await second.getByText('Photo uploaded successfully',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await second.getByText('Photo uploaded successfully',{exact:true}).waitFor();
    assert.equal(await second.locator('input[inputmode=decimal]').inputValue(),'2');
    await second.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
    await second.getByText('Saved',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),2,'saving an uploaded photo must not upload it twice');
    await page.evaluate(()=>{const r=window.__photoFixture.saved['P1019-TST-001'][1];r.photo_status='REUPLOAD_REQUIRED';r.review_note='BLURRY: retake label';});
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await first.getByText('BLURRY: retake label',{exact:true}).waitFor();
    await first.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),2,'rejected evidence needs a new photo');
    await first.locator('input[type=file]').nth(1).setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
    await first.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();
    await first.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
    await first.getByText('Saved',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),3);
    await page.locator('select').first().selectOption('P1019-ALT-001');
    await first.getByText('No cargo photo yet',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__photoFixture.role),role);
    console.log(`PASS ${role}: preview, save/refresh retention, upload reuse, rejection, replacement and pickup isolation`);
    await page.close();
  }
  const page=await browser.newPage();
  page.on("pageerror",error=>console.error("DELIVERY PAGE ERROR",error.message));
  await page.goto('http://127.0.0.1:4177/tests/browser/index.html?screen=delivery&native=1');
  await page.getByText('Take photo with camera',{exact:true}).waitFor();
  await page.getByText('Take photo with camera',{exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__nativePhotoFixture.context.deliveryWayId),'D1');
  await page.getByRole('button').filter({hasText:'D2'}).click();
  await page.evaluate(()=>window.__nativePhotoFixture.pending(new File(['camera'],'camera.jpg',{type:'image/jpeg'})));
  assert.equal(await page.getByAltText('Delivery proof to review').count(),0,'late native camera result cannot attach to another stop');
  await page.getByText('Choose from gallery',{exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__nativePhotoFixture.context.deliveryWayId),'D2','gallery also carries delivery context');
  await page.evaluate(()=>window.__nativePhotoFixture.pending(new File(['gallery'],'gallery.jpg',{type:'image/jpeg'})));
  await page.getByAltText('Delivery proof to review').waitFor();
  await page.getByText('Approve photo',{exact:true}).click();
  await page.getByText('Photo approved',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),0,'delivery approval stages proof until confirmation');
  await page.evaluate(()=>{
    const canvas=document.querySelector('canvas'); const ctx=canvas.getContext('2d');ctx.fillRect(10,10,30,3);
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_ok,error)=>error({code:1})}});
  });
  for(let attempt=0;attempt<2;attempt++){
    await page.getByText('Delivered',{exact:true}).click();
    await page.getByText('Yes',{exact:true}).click();
    await page.getByText('Current GPS is required to complete delivery. Allow location permission and try again.',{exact:true}).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),2,'retry reuses unchanged proof AND drawn signature uploads');
  }
  await page.getByRole('button').filter({hasText:'D1'}).click();
  await page.evaluate(()=>{window.__nativePhotoFixture.restored={context:{kind:'delivery-proof',deliveryWayId:'D2',route:'/delivery?deliveryWayId=D2'},file:new File(['restored'],'restored.jpg',{type:'image/jpeg'})};window.dispatchEvent(new Event('britium:native-photo-restored'));});
  assert.equal(await page.getByAltText('Delivery proof to review').count(),0,'restored gallery cannot attach to another stop');
  await page.getByRole('button').filter({hasText:'D2'}).click();
  await page.getByAltText('Delivery proof to review').waitFor();
  console.log('PASS delivery: camera/gallery scope, late-result rejection, approval, and scoped restoration');
  await page.close();
} finally {await browser.close();await server.close();}
