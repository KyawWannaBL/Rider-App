import {uniquePhoto} from './fixtures/unique-photo.mjs';
import assert from 'node:assert/strict';import path from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react-swc';import {chromium} from 'playwright-core';
const server=await createServer({configFile:false,optimizeDeps:{entries:['tests/browser/index.html']},plugins:[react()],resolve:{alias:[{find:'@/lib/nativePhoto',replacement:path.resolve('tests/browser/mockNativePhoto.ts')},{find:'../integrations/supabase/client',replacement:path.resolve('tests/browser/mockSupabase.ts')},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:4187,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII=','base64');
try{
 const page=await browser.newPage();page.on('dialog',d=>d.accept());
 await page.route('https://api.qrserver.com/**',r=>r.fulfill({contentType:'image/png',body:png}));await page.route('https://fixture-proof.test/**',r=>r.fulfill({contentType:'image/png',body:png}));
 await page.goto('http://127.0.0.1:4187/tests/browser/index.html?recovery=1');await page.locator('[data-parcel-line="1"]').waitFor();
 await page.getByRole('button',{name:'Apply Weight to All Unsaved Parcels',exact:true}).click();
 const bulk=page.locator('input[type=file][multiple]');
 for(let line=1;line<=97;line+=10){const count=Math.min(10,98-line);await bulk.setInputFiles(Array.from({length:count},(_,i)=>({name:`parcel-${line+i}.png`,mimeType:'image/png',buffer:uniquePhoto(line+i)})));await page.waitForFunction(()=>!document.querySelector('input[type=file][multiple]').disabled);await page.getByText(`Staged ${count} photos in parcel order.`,{exact:false}).waitFor();}
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Next',exact:true}).click();
 for(const line of [98,99]){const card=page.locator(`[data-parcel-line="${line}"]`);await card.locator('input[type=file]').nth(1).setInputFiles({name:`parcel-${line}.png`,mimeType:'image/png',buffer:uniquePhoto(line)});await card.getByRole('button',{name:'Approve Photo & Upload',exact:true}).waitFor();await card.locator('input[inputmode=decimal]').fill('4');}
 await page.reload();await page.locator('[data-parcel-line="1"]').waitFor();
 async function assertAllEvidence(){let weights=[];for(let p=0;p<5;p++){const cards=page.locator('[data-parcel-line]');for(let i=0;i<await cards.count();i++){const card=cards.nth(i);assert.ok(await card.getByAltText(/^Cargo parcel /).count(),'Every selected photo must survive reload');weights.push(await card.locator('input[inputmode=decimal]').inputValue());}if(p<4)await page.getByRole('button',{name:'Next',exact:true}).click();}assert.deepEqual(weights,[...Array(97).fill('2'),'4','4']);for(let p=0;p<4;p++)await page.getByRole('button',{name:'Previous',exact:true}).click();}
 await assertAllEvidence();console.log('PASS 99 photos + 97×2kg / 2×4kg survive full reload before upload');
 await page.evaluate(()=>window.__photoFixture.uploadFailOnce=[9,10,11]);await page.getByRole('button',{name:'Approve & Upload All Photos',exact:true}).click();await page.getByText('96/99',{exact:false}).waitFor({timeout:30000});
 await page.reload();await page.locator('[data-parcel-line="1"]').waitFor();await assertAllEvidence();console.log('PASS interrupted uploads retain all photos and weights across reload');
 await page.evaluate(()=>window.__photoFixture.saveFailOnce=[10]);await page.getByRole('button',{name:'Save All Ready Parcels',exact:true}).click();await page.getByText('Saved 98/99',{exact:false}).waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>Object.keys(window.__photoFixture.saved['P1019-TST-001']||{}).length),98);
 await page.reload();await page.locator('[data-parcel-line="1"]').waitFor();await assertAllEvidence();
 const before=await page.evaluate(()=>window.__photoFixture.saveCalls.length);await page.getByRole('button',{name:'Save All Ready Parcels',exact:true}).click();await page.getByText('Saved 1/1',{exact:false}).waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>window.__photoFixture.saveCalls.length),before+1,'Retry must not rewrite 98 already saved parcels');
 const saved=await page.evaluate(()=>Object.values(window.__photoFixture.saved['P1019-TST-001']));assert.equal(saved.length,99);assert.equal(saved.filter(r=>Number(r.parcel_weight)===2).length,97);assert.equal(saved.filter(r=>Number(r.parcel_weight)===4).length,2);
 console.log('PASS partial save reports 98/99; reload and retry save only the missing line; final 99 server records keep mixed weights');
 await page.close();
}finally{await browser.close();await server.close();}
