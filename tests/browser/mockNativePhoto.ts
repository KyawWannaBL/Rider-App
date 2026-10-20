const fixtureBytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9M0AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
const fixturePhoto=(file:File)=>new File([fixtureBytes],file.name,{type:file.type||'image/png'});
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
