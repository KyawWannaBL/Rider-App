import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryPhotoScope, isCurrentDeliveryPhoto } from '../src/lib/deliveryPhotoState.ts';
test('restored delivery proof is bound to its original delivery',()=>{
  assert.equal(deliveryPhotoScope({deliveryWayId:'D1',route:'/delivery?deliveryWayId=D2'}),'D1');
  assert.equal(deliveryPhotoScope({route:'/delivery?deliveryWayId=D2'}),'D2');
  assert.equal(deliveryPhotoScope({route:'/delivery'}),'');
});
test('late preparation cannot replace a newer photo or a different delivery',()=>{
  assert.equal(isCurrentDeliveryPhoto('D1',1,'D2',1),false);
  assert.equal(isCurrentDeliveryPhoto('D1',1,'D1',2),false);
  assert.equal(isCurrentDeliveryPhoto('D1',1,'D1',1),true);
});
