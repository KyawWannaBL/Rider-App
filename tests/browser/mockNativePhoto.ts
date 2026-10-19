export const NATIVE_PHOTO_RESTORED_EVENT = 'britium:native-photo-restored';
const fixture = {pending:null as null | ((file:File)=>void),context:null as any,restored:null as any};
(window as any).__nativePhotoFixture = fixture;
export const isNativeAndroidApp = () => new URLSearchParams(location.search).has('native');
export const consumeRestoredNativePhoto = () => {const r=fixture.restored; fixture.restored=null; return r;};
export const takeNativePhotoFile = async (_:string,context:any) => {fixture.context=context; return await new Promise<File>(resolve=>{fixture.pending=resolve;});};
export const chooseNativeGalleryFile = takeNativePhotoFile;
