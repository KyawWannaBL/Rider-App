import { useEffect, useState } from "react";
import { Bell, LogOut, RefreshCw } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

type NotificationRow = Record<string, any>;

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-2xl px-4 py-3 text-sm font-black transition",
    isActive ? "bg-blue-700 text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  ].join(" ");
}

export function Layout() {
  const navigate = useNavigate();
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function loadNotifications() {
    setLoadingNotifications(true);
    const { data } = await (supabase as any)
      .from("be_app_notifications")
      .select("*")
      .or("target_role.eq.rider,target_role.eq.driver,target_role.eq.helper,target_role.eq.mobile,target_role.eq.general")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoadingNotifications(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => { loadNotifications(); }, []);

  const links = [
    ["/dashboard", "Dashboard"],
    ["/jobs", "Pickup Verification"],
    ["/delivery", "Delivery / Drop-Off"],
    ["/cod-settlement", "COD Settlement"],
    ["/wallet", "Rider Wallet"],
    ["/availability", "Availability"],
    ["/documents", "Documents"],
    ["/support", "Support"],
    ["/history", "History"],
    ["/profile", "Profile"],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="text-xl font-black text-slate-950">Rider App</h1>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setOpenNotifications((v) => !v); loadNotifications(); }}
                className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
              >
                <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</span>
                {unreadCount > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>}
              </button>

              <button onClick={signOut} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
                <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign Out</span>
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {links.map(([to, label]) => <NavLink key={to} to={to} className={navClass}>{label}</NavLink>)}
          </nav>
        </div>
      </header>

      {openNotifications && (
        <section className="fixed right-4 top-28 z-40 w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Notifications</h2>
            <button onClick={loadNotifications} disabled={loadingNotifications} className="rounded-xl border p-3"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
            {notifications.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-center font-black text-slate-500">No notifications yet.</div>}
            {notifications.map((n, i) => (
              <article key={n.id || i} className={`rounded-2xl border p-4 ${n.read_at ? "bg-white" : "bg-blue-50"}`}>
                <h3 className="font-black">{n.title || "Workflow notification"}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{n.message || "-"}</p>
                <p className="mt-2 text-xs font-black text-slate-500">{n.pickup_id || ""} {n.created_at?.slice?.(0, 16) || ""}</p>
              </article>
            ))}
          </div>
          <button onClick={() => setOpenNotifications(false)} className="mt-4 w-full rounded-2xl bg-blue-700 p-3 font-black text-white">Close</button>
        </section>
      )}

      <main><Outlet /></main>
    </div>
  );
}

export default Layout;
