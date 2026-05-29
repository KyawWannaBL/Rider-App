import { supabase } from "../integrations/supabase/client";

export default function Profile() {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Rider Profile</h1>
        <p className="mt-2 font-semibold text-slate-600">
          Rider account, session, and app settings.
        </p>

        <button
          onClick={signOut}
          className="mt-6 rounded-2xl bg-rose-600 px-5 py-3 font-black text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
