import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, LogOut, Mail, MapPin, RefreshCw, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProfileDrawerProps { open: boolean; onClose: () => void; }

function text(...values: any[]) {
  return String(values.find((value) => value !== null && value !== undefined && String(value).trim() !== "") || "-");
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const navigate = useNavigate();
  const [profile,setProfile]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    const {data,error}=await (supabase as any).rpc("be_field_profile_snapshot_v91");
    if(error){setMessage(error.message);setProfile(null);} else {setProfile(data);setMessage("");}
    setLoading(false);
  }

  useEffect(()=>{ if(open) void load(); },[open]);

  async function handleLogout(){
    await supabase.auth.signOut();
    navigate("/login",{replace:true});
  }

  const canonical=profile?.canonical||{};
  const workforce=profile?.workforce||{};
  const name=text(canonical.display_name,workforce.display_name,workforce.full_name,canonical.username);
  const role=text(canonical.role,workforce.role,workforce.role_type).toUpperCase();

  return <AnimatePresence>{open&&<>
    <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}/>
    <motion.div className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-950 text-white shadow-2xl"
      initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",stiffness:300,damping:35}}>
      <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-slate-600"/></div>
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div><p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Enterprise identity</p><h2 className="mt-1 text-lg font-black">My Profile</h2></div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></button>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><X className="h-4 w-4"/></button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="flex items-center gap-4 rounded-3xl bg-white/5 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-xl font-black text-amber-300">{name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0"><p className="truncate text-lg font-black">{name}</p><p className="mt-1 text-xs font-black uppercase tracking-wider text-cyan-300">{role}</p></div>
        </div>

        {message&&<div className="rounded-2xl bg-rose-500/10 p-3 text-sm font-bold text-rose-200">{message}</div>}

        <div className="grid gap-2">
          <ProfileRow icon={<User className="h-4 w-4"/>} label="Username" value={text(canonical.username,workforce.account,workforce.account_code)}/>
          <ProfileRow icon={<Mail className="h-4 w-4"/>} label="Email" value={text(canonical.email,workforce.email,workforce.user_email)}/>
          <ProfileRow icon={<User className="h-4 w-4"/>} label="Workforce Code" value={text(canonical.worker_code,workforce.workforce_code,workforce.worker_code)}/>
          <ProfileRow icon={<Building2 className="h-4 w-4"/>} label="Branch" value={text(canonical.branch_code,workforce.branch_code,workforce.assigned_branch)}/>
          <ProfileRow icon={<MapPin className="h-4 w-4"/>} label="Assigned Zone" value={text(canonical.assigned_zone,workforce.assigned_zone,workforce.zone_code,workforce.zone)}/>
        </div>

        <button onClick={()=>{onClose();navigate("/profile");}} className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-black">Open Full Profile</button>
        <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 py-3.5 text-sm font-black text-rose-200 ring-1 ring-rose-400/20"><LogOut className="h-4 w-4"/>Sign Out</button>
      </div>
    </motion.div>
  </>}</AnimatePresence>;
}

function ProfileRow({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){
  return <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3"><span className="text-slate-400">{icon}</span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-0.5 break-all text-sm font-bold text-slate-100">{value}</p></div></div>;
}
