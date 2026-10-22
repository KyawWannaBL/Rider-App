import test from 'node:test';
import assert from 'node:assert/strict';
import { photoContentHash, existingPhotoIndex, repeatedPhotoLines, remotePhotoHash } from '../src/lib/pickupPhotoIdentity.ts';
test('photo identity uses bytes, independent of filename and upload path',async()=>{
  const first=new File(['photo A'],'one.jpg'),renamed=new File(['photo A'],'two.jpg'),different=new File(['photo B'],'one.jpg');
  assert.equal(await photoContentHash(first),await photoContentHash(renamed));
  assert.notEqual(await photoContentHash(first),await photoContentHash(different));
  const rows=[{line_no:1,cargo_photo_file:first},{line_no:2,cargo_photo_url:'https://proof.test/other-path'}];
  const remote=async()=>photoContentHash(renamed);
  assert.equal((await existingPhotoIndex(rows,remote)).size,1);
  assert.deepEqual(await repeatedPhotoLines(rows,remote),['1/2']);
});
test('a failed remote check can retry and never becomes a duplicate decision',async()=>{
  const before=globalThis.fetch; const cache=new Map(); let calls=0;
  globalThis.fetch=async()=>{calls++;if(calls===1)throw new Error('offline');return new Response('photo');};
  try { await assert.rejects(remotePhotoHash('https://proof.test/a',cache),/offline/); await remotePhotoHash('https://proof.test/a',cache); await remotePhotoHash('https://proof.test/a',cache); assert.equal(calls,2); }
  finally{globalThis.fetch=before;}
});
