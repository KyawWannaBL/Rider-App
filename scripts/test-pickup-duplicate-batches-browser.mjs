import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright-core';
import {uniquePhoto} from './fixtures/unique-photo.mjs';

const server=await createServer({configFile:false,optimizeDeps:{entries:['tests/browser/index.html']},plugins:[react()],resolve:{alias:[
  {find:'@/lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
  {find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},
  {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:4194,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage();
  await page.route('https://api.qrserver.com/**',r=>r.fulfill({contentType:'image/png',body:uniquePhoto(0)}));
  await page.route('https://fixture-proof.test/**',async r=>{
    const key=new URL(r.request().url()).pathname.slice(1);
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem('bulk-recovery-server')||'{}').objects?.[key],key);
    await r.fulfill(stored?{contentType:stored.type,headers:{'access-control-allow-origin':'*'},body:Buffer.from(stored.base64,'base64')}:{status:404});
  });
  await page.goto('http://127.0.0.1:4194/tests/browser/index.html?recovery=1');
  await page.locator('[data-parcel-line="1"]').waitFor();
  await page.getByRole('button',{name:'Apply Weight to All Unsaved Parcels',exact:true}).click();
  const photo=(seed,name=`photo-${seed}.png`)=>({name,mimeType:'image/png',buffer:uniquePhoto(seed)});
  const bulk=page.locator('input[type=file][multiple]');
  await bulk.setInputFiles(Array.from({length:10},(_,i)=>photo(i+1)));
  await page.getByText('Staged 10 photos in parcel order.',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Save All Ready Parcels',exact:true}).click();
  await page.getByText('Saved 10/10',{exact:false}).waitFor();
  await page.reload();
  await page.locator('[data-parcel-line="1"]').waitFor();
  await bulk.setInputFiles([photo(1,'renamed-first.png'),photo(10),...Array.from({length:8},(_,i)=>photo(i+11))]);
  await page.getByText('Staged 8 photos in parcel order. Skipped 2 duplicate photo(s)',{exact:false}).waitFor();
  assert.equal(await page.locator('[data-parcel-line="19"] img[alt="Cargo parcel 19"]').count(),0,'duplicates must not reserve parcel slots');
  await page.getByRole('button',{name:'Save All Ready Parcels',exact:true}).click();
  await page.getByText('Saved 8/8',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(window.__photoFixture.saved['P1019-TST-001']).length),18);
  await bulk.setInputFiles([photo(1,'another-name.png'),photo(18)]);
  await page.getByText('Staged 0 photos in parcel order. Skipped 2 duplicate photo(s)',{exact:false}).waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(window.__photoFixture.saved['P1019-TST-001']).length),18);
  await bulk.setInputFiles([photo(19,'photo-1.png'),photo(19,'renamed-copy.png')]);
  await page.getByText('Staged 1 photos in parcel order. Skipped 1 duplicate photo(s)',{exact:false}).waitFor();
  assert.equal(await page.locator('[data-parcel-line="19"]').getByAltText('Cargo parcel 19').count(),1,'same filename with different pixels must be accepted');
  await page.evaluate(()=>{
    const server=JSON.parse(localStorage.getItem('bulk-recovery-server'));
    server.saved['P1019-TST-001'][2].cargo_photo_url=server.saved['P1019-TST-001'][1].cargo_photo_url;
    localStorage.setItem('bulk-recovery-server',JSON.stringify(server));
  });
  await page.reload(); await page.locator('[data-parcel-line="1"]').waitFor();
  await page.getByRole('button',{name:'Submit Verification',exact:true}).first().click();
  await page.getByText('Duplicate parcel photos found at lines 1/2.',{exact:false}).waitFor();
  console.log('PASS 10+10 overlap stages 10+8, renamed duplicates survive reload, repeated batches create no rows, filenames are not identity');
  console.log('PASS existing duplicate proof blocks verification and identifies the parcel lines without deleting evidence');
} finally {await browser.close();await server.close();}
