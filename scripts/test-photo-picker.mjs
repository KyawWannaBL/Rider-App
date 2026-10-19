import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectGalleryPhoto } from '../src/lib/selectGalleryPhoto.ts';

test('uses embedded picker result without opening standard picker', async () => {
  let standardCalls = 0;
  assert.equal(await selectGalleryPhoto(async () => 'embedded', async () => { standardCalls++; return 'standard'; }), 'embedded');
  assert.equal(standardCalls, 0);
});
test('uses standard picker when native bridge is absent', async () => {
  assert.equal(await selectGalleryPhoto(undefined, async () => 'standard'), 'standard');
});
for (const code of ['EMBEDDED_UNAVAILABLE', 'UNAVAILABLE', 'UNIMPLEMENTED']) {
  test(`falls back once when embedded picker reports ${code}`, async () => {
    let calls = 0;
    const result = await selectGalleryPhoto(async () => { throw Object.assign(new Error('Unsupported'), { code }); }, async () => { calls++; return 'standard'; });
    assert.equal(result, 'standard');
    assert.equal(calls, 1);
  });
}
for (const code of ['PHOTO_PICKER_CANCELLED', 'PHOTO_READ_FAILED', 'PHOTO_PICKER_BUSY']) {
  test(`does not reopen another picker for ${code}`, async () => {
    let calls = 0;
    const error = Object.assign(new Error(code), { code });
    await assert.rejects(selectGalleryPhoto(async () => { throw error; }, async () => { calls++; return 'standard'; }), e => e === error);
    assert.equal(calls, 0);
  });
}
