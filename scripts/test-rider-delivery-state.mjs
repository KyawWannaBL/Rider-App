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
  await production('loadAssignedPickups',{photoWorkRef:{current:false},saveWorkRef:{current:false},batchWorkRef:{current:false},tx,setLoading:()=>{},setMessage:v=>message=v,supabase:{rpc:async()=>({data:{ok:false,error:'Pickup service unavailable'}})},setPickups:()=>replaced=true,selectedPickup:{pickup_id:'P-A'},params:{},search:'',setSelectedPickup:()=>{},setParcels:()=>{}},pickupSource)();
  assert.equal(replaced,false);assert.match(message,/Pickup service unavailable/);
});

test('refreshing the same delivery retains staged evidence and entered fields',()=>{
  let resets=0,form={receiver_name:'Edited name',payment_method:'QR',transaction_reference:'REF-1'};
  production('selectJob',{activeRole:'rider',selectedScopeRef:{current:JSON.stringify({actor:'U-A',wayplan:'W-A',delivery:'D-A'})},paymentScope:job=>({actor:'U-A',wayplan:'W-A',delivery:job.delivery_way_id}),selectedDeliveryRef:{current:'D-A'},setSelected:()=>{},resetProofs:()=>resets++,setFailureMode:()=>{},setSignatureOnBehalf:()=>{},setGeofenceRepairAvailable:()=>{},setForm:f=>form=f(form)} )({delivery_way_id:'D-A',recipient_name:'Server name'});
  assert.equal(resets,0,'Refreshing an unchanged delivery must not erase its proof/signature');
  assert.equal(form.receiver_name,'Edited name');assert.equal(form.transaction_reference,'REF-1');
});
test('a different delivery clears payment, postponement and completion state',()=>{
  let form={payment_method:'BANK_TRANSFER',reschedule_date:'2026-12-31'},progress='success',result='D-A delivered',confirmation='return';
  production('selectJob',{activeRole:'rider',selectedScopeRef:{current:JSON.stringify({actor:'U-A',wayplan:'W-A',delivery:'D-A'})},paymentScope:job=>({actor:'U-A',wayplan:'W-A',delivery:job.delivery_way_id}),selectedDeliveryRef:{current:'D-A'},setSelected:()=>{},initializePayments:()=>{},resetProofs:()=>{},setFailureMode:()=>{},setSignatureOnBehalf:()=>{},setGeofenceRepairAvailable:()=>{},setForm:f=>form=f(form),setDeliveryProgress:v=>progress=v,setDeliveryResult:v=>result=v,setConfirmAction:v=>confirmation=v})({delivery_way_id:'D-B'});
  assert.equal(form.reschedule_date,'');
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

const paymentCode=ts.transpileModule(fs.readFileSync('src/lib/deliveryPayments.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const paymentApi=await import(`data:text/javascript;base64,${Buffer.from(paymentCode).toString('base64')}`);
function deliveryEnvironment(overrides={}) {
  const entries=new Map();
  return {tx,selected:{delivery_way_id:'D-A',wayplan_id:'W-A'},selectedDeliveryRef:{current:'D-A'},canDeliver:true,helperPreparedForDriver:false,activeRole:'rider',
    form:{receiver_name:'Receiver',receiver_phone:'',signature_name:'Receiver',remarks:''},approvedProofFile:{name:'proof.jpg'},signatureFile:{name:'signature.png'},signatureRevision:{current:0},signatureCanvasFile:async()=>null,
    paymentRows:[{method:'CASH',amount:'30',reference:''},{method:'WAVE_PAY',amount:'70',reference:'W-123'}],paymentUncertain:false,requiredCod:100,
    paymentScope:()=>({actor:'U-A',wayplan:'W-A',delivery:'D-A'}),localStorage:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},...paymentApi,
    setBusy:()=>{},setPaymentUncertain:()=>{},setMsg:()=>{},setDeliveryResult:()=>{},setDeliveryProgress:()=>{},upload:async()=>'/proof',currentGps:async()=>({gps_lat:16.8,gps_lng:96.1}),markActionActive:()=>{},resetProofs:()=>{},load:async()=>{},setGeofenceRepairAvailable:()=>{},...overrides};
}
test('actual delivery mutation sends split allocations, preserving proof and GPS',async()=>{
  let sent;
  const env=deliveryEnvironment({supabase:{rpc:async(name,args)=>{sent={name,...args.p_payload};return {data:{ok:true,mobile_status:'DELIVERED'}};}}});
  assert.equal(await production('performDelivery',env)(),true);
  assert.equal(sent.name,'be_field_team_confirm_delivery_v146');
  assert.equal(sent.payment_method,'MIXED');assert.equal(sent.payment_mode,'MIXED');
  assert.deepEqual(JSON.parse(JSON.stringify(sent.payment_allocations)),[{method:'CASH',amount:30,reference:''},{method:'WAVE_PAY',amount:70,reference:'W-123'}]);
  assert.equal(sent.cod_collected_amount,100);assert.equal(sent.gps_lat,16.8);assert.equal(sent.signature_url,'/proof');
  assert.equal(paymentApi.readPaymentDraft(env.localStorage,env.paymentScope()),null);
});
test('invalid splits stop delivery before uploads and mutations',async()=>{
  let uploads=0,mutations=0;
  const env=deliveryEnvironment({paymentRows:[{method:'CASH',amount:'99',reference:''}],upload:async()=>{uploads++;},supabase:{rpc:async()=>{mutations++;}}});
  assert.equal(await production('performDelivery',env)(),false);assert.equal(uploads,0);assert.equal(mutations,0);
});
test('uncertain network response retains scoped split draft and blocks blind resubmission',async()=>{
  const env=deliveryEnvironment({supabase:{rpc:async()=>{throw new Error('Network disconnected');}}});
  assert.equal(await production('performDelivery',env)(),false);
  const draft=paymentApi.readPaymentDraft(env.localStorage,env.paymentScope());assert.equal(draft.submission,'uncertain');assert.deepEqual(draft.rows,env.paymentRows);
  let mutations=0;
  assert.equal(await production('performDelivery',{...env,paymentUncertain:true,supabase:{rpc:async()=>{mutations++;}}})(),false);assert.equal(mutations,0);
});

function selectionEnvironment(scope, previousScope, overrides={}) {
  return {selectedDeliveryRef:{current:scope.delivery},selectedScopeRef:{current:JSON.stringify(previousScope)},paymentScope:()=>scope,activeRole:'rider',
    setSelected:()=>{},initializePayments:()=>{},resetProofs:()=>{},setFailureMode:()=>{},setSignatureOnBehalf:()=>{},setGeofenceRepairAvailable:()=>{},setForm:()=>{},setDeliveryProgress:()=>{},setDeliveryResult:()=>{},setConfirmAction:()=>{},...overrides};
}
test('same parcel moved to another wayplan reinitializes payment scope and staged evidence',()=>{
  let initialized=0,resets=0;
  const scope={actor:'U-A',wayplan:'W-B',delivery:'D-A'};
  production('selectJob',selectionEnvironment(scope,{...scope,wayplan:'W-A'},{initializePayments:()=>initialized++,resetProofs:()=>resets++}))({delivery_way_id:'D-A',wayplan_id:'W-B'});
  assert.equal(initialized,1);assert.equal(resets,1);
});
test('same parcel under a different actor cannot retain the former actor payment draft',()=>{
  let initialized=0;
  const scope={actor:'U-B',wayplan:'W-A',delivery:'D-A'};
  production('selectJob',selectionEnvironment(scope,{...scope,actor:'U-A'},{initializePayments:()=>initialized++}))({delivery_way_id:'D-A',wayplan_id:'W-A'});
  assert.equal(initialized,1);
});
test('Driver same-stop refresh replaces stale local cash with authoritative Helper split without clearing proofs',()=>{
  let rows=[{method:'CASH',amount:'100',reference:''}],uncertain=true,resets=0;
  const scope={actor:'DRIVER',wayplan:'W-A',delivery:'D-A'};
  const job={delivery_way_id:'D-A',wayplan_id:'W-A',rider_status:'HELPER_COMPLETED_PENDING_DRIVER',cod_amount:100,metadata:{payment_allocations:[{method:'CASH',amount:25,reference:''},{method:'KBZ_PAY',amount:75,reference:'K-1'}]}};
  const initialize=production('initializePayments',{activeRole:'driver',paymentScope:()=>scope,localStorage:{},readPaymentDraft:()=>({rows,submission:'uncertain'}),initialPaymentRows:paymentApi.initialPaymentRows,setPaymentRows:v=>rows=v,setPaymentUncertain:v=>uncertain=v});
  production('selectJob',selectionEnvironment(scope,scope,{activeRole:'driver',initializePayments:initialize,resetProofs:()=>resets++}))(job);
  assert.deepEqual(rows,[{method:'CASH',amount:'25',reference:''},{method:'KBZ_PAY',amount:'75',reference:'K-1'}]);
  assert.equal(uncertain,false);assert.equal(resets,0);
});
test('same-stop DELIVERED refresh shows authoritative split instead of a stale draft and retains proofs',()=>{
  let rows=[{method:'CASH',amount:'100',reference:''}],uncertain=true,resets=0;
  const scope={actor:'RIDER',wayplan:'W-A',delivery:'D-A'};
  const job={delivery_way_id:'D-A',wayplan_id:'W-A',stop_status:'DELIVERED',cod_amount:100,payment_allocations:[{method:'CASH',amount:40,reference:''},{method:'WAVE_PAY',amount:60,reference:'W-1'}]};
  const initialize=production('initializePayments',{activeRole:'rider',paymentScope:()=>scope,localStorage:{},readPaymentDraft:()=>({rows,submission:'uncertain'}),initialPaymentRows:paymentApi.initialPaymentRows,setPaymentRows:v=>rows=v,setPaymentUncertain:v=>uncertain=v});
  production('selectJob',selectionEnvironment(scope,scope,{initializePayments:initialize,resetProofs:()=>resets++}))(job);
  assert.deepEqual(rows,[{method:'CASH',amount:'40',reference:''},{method:'WAVE_PAY',amount:'60',reference:'W-1'}]);
  assert.equal(uncertain,false);assert.equal(resets,0);
});
test('uncertain refresh resolves committed delivery from assigned handover queue without replaying confirmation',async()=>{
  const calls=[];let refreshed,uncertain=true;
  const selected={delivery_way_id:'D-A',wayplan_id:'W-A',receiver_name:'Original'};
  const delivered={...selected,stop_status:'DELIVERED',payment_allocations:[{method:'CASH',amount:40,reference:''},{method:'QR',amount:60,reference:'Q-1'}]};
  const env={selected,setBusy:()=>{},setMsg:()=>{},jobsFromResponse:production('jobsFromResponse',{}),selectJob:job=>refreshed=job,setPaymentUncertain:v=>uncertain=v,clearPaymentDraft:()=>{},localStorage:{},paymentScope:()=>({}),supabase:{rpc:async(name)=>{calls.push(name);return {data:{jobs:name==='be_field_team_cod_handover_queue_v1'?[delivered]:[]}};}}};
  assert.equal(await production('refreshDeliveryStatus',env)(),true);
  assert.deepEqual(calls,['be_rider_delivery_wayplan_jobs_v187','be_field_team_cod_handover_queue_v1']);
  assert.equal(refreshed.stop_status,'DELIVERED');assert.deepEqual(refreshed.payment_allocations,delivered.payment_allocations);assert.equal(uncertain,false);
});
test('uncertain refresh stays blocked when neither assigned read proves delivery',async()=>{
  for(const fallback of [[],[{delivery_way_id:'D-A',wayplan_id:'W-OTHER',stop_status:'DELIVERED'}],[{delivery_way_id:'D-A',wayplan_id:'W-A',stop_status:'ARRIVED_AT_CUSTOMER'}]]) {
    let refreshed=false,uncertain=true,message='';
    const env={selected:{delivery_way_id:'D-A',wayplan_id:'W-A'},setBusy:()=>{},setMsg:v=>message=v,jobsFromResponse:production('jobsFromResponse',{}),selectJob:()=>refreshed=true,setPaymentUncertain:v=>uncertain=v,supabase:{rpc:async(name)=>({data:{jobs:name==='be_field_team_cod_handover_queue_v1'?fallback:[]}})}};
    assert.equal(await production('refreshDeliveryStatus',env)(),false);assert.equal(refreshed,false);assert.equal(uncertain,true);assert.match(message,/Operations/);
  }
});
