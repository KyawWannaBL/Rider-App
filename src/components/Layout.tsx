import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-2xl px-4 py-3 text-sm font-black transition",
    isActive
      ? "bg-blue-700 text-white shadow-sm"
      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  ].join(" ");
}

export function Layout() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.35em] text-blue-600">
              BRITIUM EXPRESS
            </p>
            <h1 className="text-xl font-black text-slate-950">Rider App</h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/jobs" className={navClass}>
              Pickup Verification
            </NavLink>
            <NavLink to="/history" className={navClass}>
              History
            </NavLink>
            <NavLink to="/profile" className={navClass}>
              Profile
            </NavLink>
            <button
              onClick={signOut}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
