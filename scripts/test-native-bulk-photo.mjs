import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const values=new Map(),listeners={};
  const state={limit:0,result:{photos:[{path:'file:///one.jpg'},{path:'file:///two.jpg'}]},error:null};
  const box={exports:{}};
  const location={hash:'#/pickup-verification'};
  const code=ts.transpileModule(fs.readFileSync('src/lib/nativePhoto.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module:box,exports:box.exports,File,Blob,Date,console,Uint8Array,atob,CustomEvent,
    localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
    window:{location,dispatchEvent(){}},
    fetch:async()=>({ok:true,blob:async()=>new Blob(['normalized image'],{type:'image/jpeg'})}),
    require(name){
      if(name==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android',isPluginAvailable:()=>true,convertFileSrc:x=>x},registerPlugin:name=>name==='App'?{addListener:async(n,fn)=>{listeners[n]=fn;return{remove:async()=>{}};}}:{pickImages:async({limit,batchId})=>{state.limit=limit;state.batchId=batchId;if(state.error)throw state.error;return {...state.result,batchId};},resumeImages:async({batchId})=>({...state.result,batchId}),finishBatch:async()=>{}}};
      if(name==='@capacitor/camera')return{Camera:{},CameraSource:{Camera:'CAMERA',Photos:'PHOTOS'},CameraResultType:{Uri:'uri'}};
      if(name==='./selectGalleryPhoto')return{};
      throw Error(name);
    },
  });
  return{api:box.exports,state,values,listeners,location};
}
const context={kind:'pickup-bulk',pickupId:'P-1',lineNos:[1,2],route:'/pickup-verification/P-1'};
{
 const f=fixture();
 const files=await f.api.chooseNativeGalleryFiles('bulk',context,50);
 assert.equal(f.state.limit,10,'native selection must have a bounded limit');
 assert.equal(files.length,2);assert.equal(files[0].type,'image/jpeg');
 assert.equal(f.values.size,0,'successful selection clears pending context');
 f.state.error=new Error('Photo selection was cancelled.');
 await assert.rejects(f.api.chooseNativeGalleryFiles('bulk',context,2),/cancelled/);
 assert.equal(f.values.size,0,'cancellation must not cause a later route jump');
}
{
 const f=fixture();f.api.installNativePhotoRestoreHandler();
 f.state.error=new Error('Activity recreated');
 await assert.rejects(f.api.chooseNativeGalleryFiles('bulk',context,2),/Activity recreated/);
 assert.equal(JSON.parse([...f.values.values()][0]).pickupId,'P-1','interruption keeps pickup identity');
 await assert.rejects(f.api.chooseNativeGalleryFiles('other',{...context,pickupId:'P-OTHER'},2),/previous photo selection/);
 assert.equal(JSON.parse([...f.values.values()][0]).pickupId,'P-1','a second launch must not replace the original context');
 await f.listeners.appRestoredResult({pluginId:'BritiumPhotoPicker',methodName:'pickImages',success:true,data:{...f.state.result,batchId:'wrong-batch'}});
 assert.equal(f.api.peekRestoredNativePhoto(),null,'unrelated native result cannot use the current pickup context');
 await f.listeners.appRestoredResult({pluginId:'BritiumPhotoPicker',methodName:'pickImages',success:true,data:{...f.state.result,batchId:f.state.batchId}});
 const restored=f.api.peekRestoredNativePhoto();
 assert.equal(restored.files.length,2);assert.equal(restored.context.pickupId,'P-1');
 assert.equal(f.location.hash,'#/pickup-verification/P-1');
 assert.equal(f.values.size,0);
}
{
 const f=fixture();f.state.result.photos.push({path:'file:///extra.jpg'});
 await assert.rejects(f.api.chooseNativeGalleryFiles('bulk',context,2),/at most 2/,'provider cannot silently overflow parcel slots');
}
{
 const f=fixture();f.state.error=new Error('Activity recreated during normalization');
 await assert.rejects(f.api.chooseNativeGalleryFiles('bulk',context,2),/Activity recreated/);
 f.api.installNativePhotoRestoreHandler();
 for(let i=0;i<30&&!f.api.peekRestoredNativePhoto();i++)await Promise.resolve();
 assert.equal(f.api.peekRestoredNativePhoto()?.files.length,2,'startup resumes native normalization from the cached selection');
 assert.equal(f.location.hash,'#/pickup-verification/P-1');
}
console.log('PASS native bulk bridge: bounded selection, cancellation, interrupted route/context and restored files');
