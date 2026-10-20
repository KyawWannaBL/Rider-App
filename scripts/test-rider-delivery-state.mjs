import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source=fs.readFileSync('src/pages/DeliveryPage.tsx','utf8');
const ast=ts.createSourceFile('DeliveryPage.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function production(name,env,fileSource=source) {
  const fileAst=fileSource===source?ast:ts.createSourceFile('source.tsx',fileSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let node;
  const walk=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text===name)node=n;ts.forEachChild(n,walk);};walk(fileAst);
  assert.ok(node,`Production handler ${name} exists`);
  const code=ts.transpileModule(node.getText(fileAst)+`\n${name};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return vm.runInNewContext(code,{console,File,...env});
}
const tx=en=>en;

test('Delivery snapshot application errors retain the current jobs and evidence',async()=>{
  let replaced=false,message='';
  await production('load',{tx,setMsg:v=>message=v,supabase:{rpc:async()=>({data:{ok:false,error:'Delivery service unavailable'}})},jobsFromResponse:production('jobsFromResponse',{}),setPickups:()=>replaced=true,setSelected:()=>{},selectedDeliveryRef:{current:'D-A'},resetProofs:()=>{},selectJob:()=>{},setFailureReasons:()=>{}})();
  assert.equal(replaced,false);assert.match(message,/Delivery service unavailable/);
});
test('Pickup snapshot application errors retain staged parcels and show the error',async()=>{
  let replaced=false,message='';
  const pickupSource=fs.readFileSync('src/pages/RiderPickupPhotoQrPortal.tsx','utf8');
  await production('loadAssignedPickups',{tx,setLoading:()=>{},setMessage:v=>message=v,supabase:{rpc:async()=>({data:{ok:false,error:'Pickup service unavailable'}})},setPickups:()=>replaced=true,selectedPickup:{pickup_id:'P-A'},params:{},search:'',setSelectedPickup:()=>{},setParcels:()=>{}},pickupSource)();
  assert.equal(replaced,false);assert.match(message,/Pickup service unavailable/);
});

test('refreshing the same delivery retains staged evidence and entered fields',()=>{
  let resets=0,form={receiver_name:'Edited name',payment_method:'QR',transaction_reference:'REF-1'};
  production('selectJob',{selectedDeliveryRef:{current:'D-A'},setSelected:()=>{},resetProofs:()=>resets++,setFailureMode:()=>{},setSignatureOnBehalf:()=>{},setGeofenceRepairAvailable:()=>{},setForm:f=>form=f(form)} )({delivery_way_id:'D-A',recipient_name:'Server name'});
  assert.equal(resets,0,'Refreshing an unchanged delivery must not erase its proof/signature');
  assert.equal(form.receiver_name,'Edited name');assert.equal(form.transaction_reference,'REF-1');
});
test('a different delivery clears payment, postponement and completion state',()=>{
  let form={payment_method:'BANK_TRANSFER',reschedule_date:'2026-12-31'},progress='success',result='D-A delivered',confirmation='return';
  production('selectJob',{selectedDeliveryRef:{current:'D-A'},setSelected:()=>{},resetProofs:()=>{},setFailureMode:()=>{},setSignatureOnBehalf:()=>{},setGeofenceRepairAvailable:()=>{},setForm:f=>form=f(form),setDeliveryProgress:v=>progress=v,setDeliveryResult:v=>result=v,setConfirmAction:v=>confirmation=v})({delivery_way_id:'D-B'});
  assert.equal(form.payment_method,'CASH');assert.equal(form.reschedule_date,'');
  assert.equal(progress,'idle');assert.equal(result,'');assert.equal(confirmation,null);
});
test('unconfirmed or failed actions never receive a success indicator',async()=>{
  for(const answer of [undefined,false]){
    const marked=[];
    const result=await production('executeConfirmedAction',{setConfirmAction:()=>{},failAndReturnToWarehouse:async()=>answer,markActionActive:a=>marked.push(a)})('return');
    assert.equal(marked.length,0);assert.equal(result,answer);
  }
});
test('return-to-warehouse backend rejection returns false',async()=>{
  let message='';
  const result=await production('failAndReturnToWarehouse',{selected:{delivery_way_id:'D-A',wayplan_id:'W-A'},failureMode:true,form:{failed_reason:'NO_ANSWER',remarks:''},currentGps:async()=>({}),setBusy:()=>{},supabase:{rpc:async()=>({data:{ok:false,error:'Server rejected return'}})},setMsg:v=>message=v,tx}) ();
  assert.equal(result,false);assert.match(message,/Server rejected return/);
});
test('unsuccessful GPS checks return false',async()=>{
  const result=await production('sendGps',{selected:{delivery_way_id:'D-A'},currentGps:async()=>({}),setMsg:()=>{},tx})();
  assert.equal(result,false);
});
test('postponement errors return false rather than confirming warehouse return',async()=>{
  const result=await production('failDelivery',{selected:{delivery_way_id:'D-A'},form:{failed_reason:'CUSTOMER_REQUESTED_RESCHEDULE',remarks:'',reschedule_date:''},setMsg:()=>{},tx})();
  assert.equal(result,false);
});
test('a successful postponement returns its actual result through the return action',async()=>{
  const result=await production('failAndReturnToWarehouse',{selected:{delivery_way_id:'D-A'},failureMode:true,form:{failed_reason:'CUSTOMER_REQUESTED_RESCHEDULE',remarks:''},failDelivery:async()=>true,setMsg:()=>{},tx})();
  assert.equal(result,true);
});
test('late signature encoding cannot cache another delivery signature',async()=>{
  let finish;
  const selectedDeliveryRef={current:'D-A'},drawnSignatureRef={current:null},signatureRevision={current:1};
  const signatureCanvasRef={current:{width:1,height:1,getContext:()=>({getImageData:()=>({data:[0,0,0,255]})}),toBlob:callback=>finish=callback}};
  const pending=production('signatureCanvasFile',{selectedDeliveryRef,drawnSignatureRef,signatureRevision,signatureCanvasRef})();
  selectedDeliveryRef.current='D-B';signatureRevision.current++;
  finish(new Blob(['A signature'],{type:'image/png'}));
  assert.equal(await pending,null);assert.equal(drawnSignatureRef.current,null);
});
test('signature encoding failure is presented as a recoverable delivery error',async()=>{
  let progress='',message='';
  const result=await production('performDelivery',{selected:{delivery_way_id:'D-A'},selectedDeliveryRef:{current:'D-A'},canDeliver:true,helperPreparedForDriver:false,form:{receiver_name:'Receiver'},approvedProofFile:{},signatureRevision:{current:0},signatureCanvasFile:async()=>{throw Error('Canvas encoding failed');},setDeliveryProgress:v=>progress=v,setDeliveryResult:v=>message=v,setMsg:v=>message=v,tx})();
  assert.equal(result,false);assert.equal(progress,'error');assert.match(message,/Canvas encoding failed/);
});

test('changing the signature during validation aborts the captured upload',async()=>{
  let finish,uploads=0;
  const signatureRevision={current:1};
  const pending=production('performDelivery',{selected:{delivery_way_id:'D-A',wayplan_id:'W-A'},selectedDeliveryRef:{current:'D-A'},signatureRevision,canDeliver:true,helperPreparedForDriver:false,form:{receiver_name:'Receiver',cod_collected:'0',signature_name:'Receiver'},approvedProofFile:{},signatureFile:{name:'old-signature.png'},signatureCanvasFile:()=>new Promise(resolve=>finish=resolve),requiredCod:0,electronicPayment:false,setBusy:()=>{},upload:async()=>{uploads++;return 'url';},setDeliveryProgress:()=>{},setDeliveryResult:()=>{},setMsg:()=>{},tx})();
  signatureRevision.current++;finish(null);
  assert.equal(await pending,false);assert.equal(uploads,0,'must not upload the stale captured signature');
});
