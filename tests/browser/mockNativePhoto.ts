export const NATIVE_PHOTO_RESTORED_EVENT = 'britium:native-photo-restored';
const fixture = {pending:null as null | ((file:File)=>void),context:null as any,restored:null as any};
(window as any).__nativePhotoFixture = fixture;
export const isNativeAndroidApp = () => new URLSearchParams(location.search).has('native');
export const consumeRestoredNativePhoto = () => {const r=fixture.restored; fixture.restored=null; return r;};
export const takeNativePhotoFile = async (_:string,context:any) => {fixture.context=context; return await new Promise<File>(resolve=>{fixture.pending=resolve;});};
export const chooseNativeGalleryFile = takeNativePhotoFile;
export const peekRestoredNativePhoto = () => fixture.restored;
export const hasNativePhotoBridge = isNativeAndroidApp;
export const shouldUseHtmlCameraCapture = () => false;
export const chooseNativeGalleryFiles = async (_:string,context:any,limit:number) => {
  fixture.context=context;
  return await new Promise<File[]>(resolve=>{(fixture as any).bulkPending=resolve;(fixture as any).limit=limit;});
};
