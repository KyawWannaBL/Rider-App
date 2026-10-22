const fixturePhoto=(file:File)=>{
  let hash=2166136261; for(const c of file.name) hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const canvas=document.createElement('canvas'); canvas.width=4; canvas.height=4;
  const context=canvas.getContext('2d')!; context.fillStyle=`rgb(${hash&255},${(hash>>>8)&255},${(hash>>>16)&255})`; context.fillRect(0,0,4,4);
  const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));
  return new File([bytes],file.name,{type:file.type||'image/png'});
};
export const NATIVE_PHOTO_RESTORED_EVENT = 'britium:native-photo-restored';
const fixture = {pending:null as null | ((file:File)=>void),context:null as any,restored:null as any};
(window as any).__nativePhotoFixture = fixture;
export const isNativeAndroidApp = () => new URLSearchParams(location.search).has('native');
export const consumeRestoredNativePhoto = () => {const r=fixture.restored; fixture.restored=null; return r;};
export const takeNativePhotoFile = async (_:string,context:any) => {fixture.context=context; return await new Promise<File>(resolve=>{fixture.pending=file=>resolve(fixturePhoto(file));});};
export const chooseNativeGalleryFile = takeNativePhotoFile;
export const peekRestoredNativePhoto = () => fixture.restored ? {...fixture.restored,...(fixture.restored.file?{file:fixturePhoto(fixture.restored.file)}:{}),...(fixture.restored.files?{files:fixture.restored.files.map(fixturePhoto)}:{})} : null;
export const hasNativePhotoBridge = isNativeAndroidApp;
export const shouldUseHtmlCameraCapture = () => false;
export const chooseNativeGalleryFiles = async (_:string,context:any,limit:number) => {
  fixture.context=context;
  return await new Promise<File[]>(resolve=>{(fixture as any).bulkPending=(files:File[])=>resolve(files.map(fixturePhoto));(fixture as any).limit=limit;});
};
