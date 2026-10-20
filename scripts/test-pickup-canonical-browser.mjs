import assert from 'node:assert/strict';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright-core';
const server=await createServer({configFile:false,optimizeDeps:{entries:['tests/browser/index.html']},plugins:[react()],resolve:{alias:[
 {find:'@/lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},
 {find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},
 {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:4193,strictPort:true}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII=','base64');
try {
 const page=await browser.newPage(); page.on('dialog',d=>d.accept());
 await page.route('https://api.qrserver.com/**',r=>r.fulfill({contentType:'image/png',body:png}));
 await page.goto('http://127.0.0.1:4193/tests/browser/index.html?canonical=1');
 const card=page.locator('[data-parcel-line="1"]');
 for(const [index,pickup] of ['P1020-TST-001','P1020-TST-002'].entries()){
  await page.locator('select').first().selectOption(pickup);
  await card.getByText('No cargo photo yet',{exact:true}).waitFor();
  await card.locator('input[type=file]').nth(1).setInputFiles({name:`proof-${index}.png`,mimeType:'image/png',buffer:png});
  await card.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();
  await card.locator('input[inputmode=decimal]').fill('2');
  await card.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
  await card.getByText('Saved',{exact:true}).waitFor();
  const payload=await page.evaluate(()=>window.__photoFixture.savePayloads.at(-1));
  assert.equal(payload.delivery_way_id,undefined,'New line cannot send the provisional D ID as authoritative');
  assert.equal(payload.waybill_no,undefined,'New line cannot send its provisional W ID');
  assert.equal(payload.temp_qr_code,undefined,'Server returns its authoritative temporary QR payload');
  await card.getByText(`D1020-TST-00${index+1}`,{exact:true}).first().waitFor();
  await card.getByAltText(`TQR-${pickup}-001`,{exact:true}).waitFor();
 }
 const saved=await page.evaluate(()=>Object.values(window.__photoFixture.saved).flatMap(Object.values));
 assert.equal(new Set(saved.map(row=>row.delivery_way_id)).size,2);
 // Refresh/edited retry must reuse the returned ID, never re-submit a generated fallback.
 await page.locator('select').first().selectOption('P1020-TST-001');
 await card.getByText('Saved',{exact:true}).waitFor();
 await card.locator('input[inputmode=decimal]').fill('4');
 await card.getByRole('button',{name:'Save Photo & Parcel',exact:true}).click();
 await card.getByText('Saved',{exact:true}).waitFor();
 const retry=await page.evaluate(()=>window.__photoFixture.savePayloads.at(-1));
 assert.equal(retry.delivery_way_id,'D1020-TST-001');
 assert.equal(await card.locator('input[inputmode=decimal]').inputValue(),'4');
 assert.equal(await page.evaluate(()=>window.__photoFixture.uploads.length),2,'Canonical ID reconciliation must not duplicate photo uploads');
 console.log('PASS production UI omits provisional IDs for same-merchant pickups, uses canonical response/QR, and preserves seeded retry IDs and photos');
} finally { await browser.close(); await server.close(); }
