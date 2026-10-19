const role = new URLSearchParams(location.search).get('role') || 'rider';
const pickups = ['P1019-TST-001','P1019-ALT-001'].map(pickup_id => ({pickup_id,parcel_count:2,merchant_name:'Synthetic browser fixture',assigned_to_me:true,can_open_workspace:true,can_capture:true,assignment_scope:'ASSIGNED_TO_ME',next_action:'CAPTURE_AND_VERIFY',role}));
const saved: Record<string,Record<number,any>> = {};
const objects = new Map<string,File>();
const state = {role,pickups,saved,uploads:[] as string[],snapshotDelay:0,saveDelay:0,uploadDelay:0};
(window as any).__photoFixture=state;
export const supabase = {
  auth:{getUser:async()=>({data:{user:{id:'synthetic-worker'}},error:null}),getSession:async()=>({data:{session:{user:{id:'synthetic-worker'}}},error:null})},
  rpc:async(name:string,args:any)=>{
    if(name==='be_rider_delivery_wayplan_jobs_v187') return {data:{jobs:['D1','D2'].map(delivery_way_id=>({delivery_way_id,wayplan_id:'W1',receiver_name:'Synthetic receiver',stop_status:'ARRIVED_AT_CUSTOMER'}))},error:null};
    if(name==='be_field_pickup_request_options_v187') return {data:{ok:true,requests:pickups,counts:{assigned_to_me:2}},error:null};
    if(name==='be_pickup_parcel_capture_snapshot') {
      if(state.snapshotDelay) await new Promise(r=>setTimeout(r,state.snapshotDelay));
      return {data:{ok:true,parcels:Object.values(saved[args.p_pickup_id]||{})},error:null};
    }
    if(name==='be_pickup_parcel_capture_save') {
      const p=args.p_payload;
      if(state.saveDelay) await new Promise(r=>setTimeout(r,state.saveDelay));
      saved[p.pickup_id] ||= {};
      saved[p.pickup_id][p.line_no]={...p,photo_status:'PENDING_REVIEW',saved:true};
      return {data:{ok:true,photo_status:'PENDING_REVIEW'},error:null};
    }
    return {data:{ok:true},error:null};
  },
  storage:{from:()=>({
    upload:async(path:string,file:File)=>{
      state.uploads.push(path);
      if(state.uploadDelay) await new Promise(r=>setTimeout(r,state.uploadDelay));
      if(objects.has(path))return {data:null,error:{statusCode:409,message:'already exists'}};
      objects.set(path,file);return {data:{path},error:null};
    },
    download:async(path:string)=>({data:objects.get(path),error:null}),
    getPublicUrl:(path:string)=>({data:{publicUrl:URL.createObjectURL(objects.get(path)!)}}),
  })},
};

export const isSupabaseConfigured=true;
