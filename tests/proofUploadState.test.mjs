import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmPhotoUpload } from '../src/lib/proofUploadState.ts';

test('a timed-out upload retry reuses the in-flight request', async () => {
  let complete; let calls=0;
  const pending=new Map();
  const upload=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};
  await assert.rejects(confirmPhotoUpload({path:'same',pending,upload,timeoutMs:5}), /confirmation timed out/);
  const retry=confirmPhotoUpload({path:'same',pending,upload,timeoutMs:1000});
  complete({error:null});
  await retry;
  assert.equal(calls,1);
});

test('an actual failed upload can be retried', async () => {
  const pending=new Map(); let calls=0;
  const upload=async()=>{calls++;return calls===1?{error:new Error('offline')}:{error:null};};
  await assert.rejects(confirmPhotoUpload({path:'retry',pending,upload}),/offline/);
  await confirmPhotoUpload({path:'retry',pending,upload});
  assert.equal(calls,2);
});

test('duplicate object errors require matching stored evidence', async () => {
  const upload=async()=>({error:{statusCode:'409',message:'already exists'}});
  await assert.rejects(confirmPhotoUpload({path:'wrong',pending:new Map(),upload,verifyExisting:async()=>false}));
  await confirmPhotoUpload({path:'same',pending:new Map(),upload,verifyExisting:async()=>true});
});
