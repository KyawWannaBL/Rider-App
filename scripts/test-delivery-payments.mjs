import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const path='src/lib/deliveryPayments.ts';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('split CASH / KBZ PAY preserves amounts and references with exact MMK totals',()=>{
  assert.equal(typeof api.buildPaymentPayload,'function');
  const payload=api.buildPaymentPayload([{method:'CASH',amount:'1250.25',reference:''},{method:'KBZ_PAY',amount:'500.50',reference:' KBZ-123 '}],1750.75);
  assert.equal(payload.payment_method,'MIXED');assert.equal(payload.payment_mode,'MIXED');
  assert.equal(payload.cod_collected_amount,1750.75);
  assert.deepEqual(payload.payment_allocations,[{method:'CASH',amount:1250.25,reference:''},{method:'KBZ_PAY',amount:500.5,reference:'KBZ-123'}]);
  assert.deepEqual(api.paymentTotals(payload.payment_allocations),{cash:1250.25,digital:500.5,total:1750.75});
});
test('rejects short/over payments, missing digital references and invalid MMK',()=>{
  for(const [rows,total] of [
    [[{method:'CASH',amount:'99',reference:''}],100],
    [[{method:'CASH',amount:'101',reference:''}],100],
    [[{method:'WAVE_PAY',amount:'100',reference:' '}],100],
    [[{method:'CASH',amount:'1.001',reference:''}],1.001],
    [[{method:'CASH',amount:'-1',reference:''}],0],
    [[{method:'CASH',amount:'0',reference:''}],0],
    [[{method:'PREPAID',amount:'100',reference:''}],100],
    [[],100],
  ]) assert.throws(()=>api.buildPaymentPayload(rows,total));
});
test('zero expected collection has no payment rows; decimal totals use integer minor units',()=>{
  assert.deepEqual(api.buildPaymentPayload([],0).payment_allocations,[]);
  assert.equal(api.buildPaymentPayload([{method:'CASH',amount:'0.10'},{method:'CASH',amount:'0.20'}],0.3).payment_method,'CASH');
});
test('existing unknown and mixed records are never invented as cash',()=>{
  assert.deepEqual(api.initialPaymentRows({payment_mode:'MIXED',cod_collected:100,stop_status:'DELIVERED'},100),[]);
  assert.deepEqual(api.initialPaymentRows({cod_collected:100,stop_status:'DELIVERED'},100),[]);
  assert.deepEqual(api.initialPaymentRows({metadata:{payment_allocations:[{method:'KBZ_PAY',amount:100,reference:'K'}]}},100),[{method:'KBZ_PAY',amount:'100',reference:'K'}]);
  assert.equal(api.recordedPaymentSummary({payment_mode:'MIXED',cod_collected:100}).method,'UNKNOWN');
  assert.equal(api.recordedPaymentSummary({payment_mode:'MOBILE_WALLET',cod_collected:100}).cash,0);
  assert.equal(api.recordedPaymentSummary({metadata:{payment_allocations:[{method:'CASH',amount:30,reference:''},{method:'WAVE_PAY',amount:70,reference:'W'}]},cod_collected:100}).cash,30);
});
test('drafts are scoped to actor + wayplan + parcel and preserve rows and submission state',()=>{
  const entries=new Map();const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const scope={actor:'user-1',wayplan:'WP-1',delivery:'D-1'};
  const rows=[{method:'CB_PAY',amount:'100.25',reference:'CB-1'}];
  api.writePaymentDraft(storage,scope,{rows,submission:'uncertain'});
  assert.deepEqual(api.readPaymentDraft(storage,scope),{rows,submission:'uncertain'});
  assert.equal(api.readPaymentDraft(storage,{...scope,actor:'user-2'}),null);
  assert.equal(api.readPaymentDraft(storage,{...scope,wayplan:'WP-2'}),null);
  api.clearPaymentDraft(storage,scope);assert.equal(api.readPaymentDraft(storage,scope),null);
});

test('handover queue reported allocations and amounts retain the original split',()=>{
  const row={reported_collected:100,metadata:{reported_payment_allocations:[{method:'CASH',amount:25,reference:''},{method:'KBZ_PAY',amount:75,reference:'K'}]}};
  assert.equal(api.recordedPaymentSummary(row).cash,25);
  assert.equal(api.initialPaymentRows(row,100)[1].method,'KBZ_PAY');
  assert.deepEqual(api.initialPaymentRows({authoritative_cod_collected:100},100),[]);
});
