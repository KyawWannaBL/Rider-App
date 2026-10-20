import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCaptureParcels, canReuseUploadedPhoto, isCurrentParcelDraft } from '../src/lib/pickupPhotoState.ts';

const blank = line_no => ({ line_no, parcel_weight: '', remarks: '', saved: false });
const saved = line_no => ({ line_no, parcel_weight: 2, cargo_photo_url: 'https://proof/'+line_no, photo_status: 'PENDING_REVIEW', saved: true });

test('late upload or save results cannot replace a newer parcel draft', () => {
  const submitted={...blank(1),draft_revision:1};
  assert.equal(isCurrentParcelDraft({...submitted,draft_revision:2},submitted),false);
  assert.equal(isCurrentParcelDraft(undefined,submitted),false);
  assert.equal(isCurrentParcelDraft({...submitted,line_no:2},submitted),false);
  assert.equal(isCurrentParcelDraft(submitted,submitted),true);
});

test('saving one parcel preserves another parcel photo and actual weight on refresh', () => {
  const file = new File(['camera bytes'], 'parcel2.jpg', { type: 'image/jpeg' });
  const local = [blank(1), { ...blank(2), parcel_weight:'4.5', cargo_photo_file:file, cargo_photo_data_url:'blob:parcel2', photo_status:'photo_staged' }];
  const rows = mergeCaptureParcels([blank(1),blank(2)], [saved(1)], local);
  assert.equal(rows[0].saved,true);
  assert.equal(rows[1].cargo_photo_file,file);
  assert.equal(rows[1].parcel_weight,'4.5');
});

test('upload-only photos survive a server snapshot with no saved parcel', () => {
  const rows = mergeCaptureParcels([blank(1)], [], [{...blank(1),cargo_photo_url:'https://proof/new',photo_status:'photo_uploaded'}]);
  assert.equal(rows[0].cargo_photo_url,'https://proof/new');
  assert.equal(rows[0].saved,false);
});

test('server rejection and note remain visible and require a new photo', () => {
  const server = {...saved(1),photo_status:'REUPLOAD_REQUIRED',review_note:'BLURRY: retake label'};
  const row = mergeCaptureParcels([blank(1)],[server],[])[0];
  assert.equal(row.review_status,'REUPLOAD_REQUIRED');
  assert.equal(row.review_note,'BLURRY: retake label');
  assert.equal(row.saved,false);
  assert.equal(canReuseUploadedPhoto(row),false);
  assert.equal(canReuseUploadedPhoto({...row,cargo_photo_url:'https://proof/replacement'}),true);
});

test('an empty seeded verification row must not count as saved', () => {
  const row = mergeCaptureParcels([blank(1)],[{line_no:1,saved:true,parcel_weight:0,cargo_photo_url:''}],[])[0];
  assert.equal(row.saved,false);
});

test('refresh updates independent review status without discarding a pending replacement', () => {
  const file=new File(['new'],'new.jpg',{type:'image/jpeg'});
  const row=mergeCaptureParcels([blank(1)],[{...saved(1),photo_status:'REUPLOAD_REQUIRED',review_note:'wrong parcel'}],[{...blank(1),cargo_photo_file:file,cargo_photo_data_url:'blob:new'}])[0];
  assert.equal(row.cargo_photo_file,file);
  assert.equal(row.review_status,'REUPLOAD_REQUIRED');
});

test('a partial snapshot cannot erase recovered evidence from a 99-photo mixed-weight batch', () => {
  const generated=Array.from({length:99},(_,i)=>blank(i+1));
  const recovered=generated.map(row=>({...row,saved:true,parcel_weight:row.line_no>97?'4':'2',cargo_photo_url:'https://proof/'+row.line_no}));
  const stored=[1,2,3,4,5,6,7,8,12,13,14].map(saved);
  const merged=mergeCaptureParcels(generated,stored,recovered);
  assert.equal(merged.filter(row=>row.cargo_photo_url).length,99,'missing server rows must keep recoverable local evidence');
  assert.equal(merged.filter(row=>row.saved).length,11,'only authoritative server rows are counted as saved');
  assert.equal(merged[98].parcel_weight,'4');assert.equal(merged[8].saved,false);
});

 test('incomplete server confirmation retains cached evidence as an unsaved draft', () => {
  const row=mergeCaptureParcels([blank(1)],[{line_no:1,parcel_weight:0,cargo_photo_url:'',photo_status:'REUPLOAD_REQUIRED',review_note:'verify label'}],[{...saved(1),parcel_weight:'2',cargo_photo_url:'https://proof/cached'}])[0];
  assert.equal(row.cargo_photo_url,'https://proof/cached');
  assert.equal(row.parcel_weight,'2');
  assert.equal(row.saved,false);
  assert.equal(row.review_note,'verify label');
 });
