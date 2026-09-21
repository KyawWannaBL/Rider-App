import { useEffect, useState } from "react";
import { Bell, CheckCheck, Globe2, LogOut, RefreshCw } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";

type NotificationRow = Record<string, any>;

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-2xl px-4 py-3 text-sm font-black transition",
    isActive ? "bg-blue-700 text-white shadow-sm" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  ].join(" ");
}

export function Layout() {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useAppState();
  const tx = (en: string, my: string) => language === "my" ? my : en;
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !(n.is_read || n.read_at)).length;

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v77", {
        p_payload: { notification_limit: 50 },
      });
      if (error) throw error;
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (error) {
      console.error("Unable to load Rider notifications", error);
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function markNotificationRead(notification: NotificationRow) {
    if (!notification?.id || notification.is_read || notification.read_at) return;
    const { error } = await (supabase as any).rpc("be_mark_app_notification_read", {
      p_notification_id: notification.id,
      p_login: null,
    });
    if (!error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item
        )
      );
    }
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => n?.id && !(n.is_read || n.read_at));
    await Promise.all(unread.map((n) => markNotificationRead(n)));
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => { loadNotifications(); }, []);

  const links = [
    ["/dashboard", tx("Dashboard", "ပင်မစာမျက်နှာ")],
    ["/jobs", tx("Pickup Verification", "Pickup စစ်ဆေးအတည်ပြုခြင်း")],
    ["/delivery", tx("Delivery / Drop-Off", "ပို့ဆောင် / ပစ္စည်းချခြင်း")],
    ["/cod-settlement", tx("COD Settlement", "COD ငွေစာရင်းရှင်းခြင်း")],
    ["/wallet", tx("Rider Wallet", "Rider ငွေစာရင်း")],
    ["/availability", tx("Availability", "အလုပ်ဆင်းနိုင်မှု")],
    ["/documents", tx("Documents", "စာရွက်စာတမ်းများ")],
    ["/support", tx("Support", "အကူအညီ")],
    ["/history", tx("History", "မှတ်တမ်း")],
    ["/profile", tx("Profile", "ကိုယ်ရေးအချက်အလက်")],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-blue-600">BRITIUM EXPRESS</p>
              <h1 className="text-xl font-black text-slate-950">{tx("Rider App", "Rider အက်ပ်")}</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleLanguage}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800"
                aria-label={tx("Switch language", "ဘာသာစကားပြောင်းရန်")}
                title={tx("Switch to Myanmar", "English သို့ပြောင်းရန်")}
              >
                <span className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {language === "my" ? "English" : "မြန်မာ"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setOpenNotifications((v) => !v); loadNotifications(); }}
                className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
              >
                <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> {tx("Notifications", "အသိပေးချက်များ")}</span>
                {unreadCount > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white">{unreadCount}</span>}
              </button>

              <button onClick={signOut} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
                <span className="flex items-center gap-2"><LogOut className="h-4 w-4" /> {tx("Sign Out", "အကောင့်မှထွက်ရန်")}</span>
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
            <h2 className="text-lg font-black">{tx("Notifications", "အသိပေးချက်များ")}</h2>
            <div className="flex gap-2">
              <button onClick={markAllRead} disabled={loadingNotifications || unreadCount === 0} className="rounded-xl border p-3 disabled:opacity-40" title={tx("Mark all read", "အားလုံးဖတ်ပြီးအဖြစ်သတ်မှတ်ရန်")}><CheckCheck className="h-4 w-4" /></button>
              <button onClick={loadNotifications} disabled={loadingNotifications} className="rounded-xl border p-3"><RefreshCw className={`h-4 w-4 ${loadingNotifications ? "animate-spin" : ""}`} /></button>
            </div>
          </div>
          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
            {notifications.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-center font-black text-slate-500">{tx("No notifications yet.", "အသိပေးချက်မရှိသေးပါ။")}</div>}
            {notifications.map((n, i) => (
              <article
                key={n.id || i}
                onClick={() => markNotificationRead(n)}
                className={`cursor-pointer rounded-2xl border p-4 transition hover:border-blue-300 ${n.is_read || n.read_at ? "bg-white" : "bg-blue-50"}`}
              >
                <h3 className="font-black">{n.title || tx("Workflow notification", "လုပ်ငန်းစဉ်အသိပေးချက်")}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{n.message || "-"}</p>
                <p className="mt-2 text-xs font-black text-slate-500">{n.pickup_id || ""} {n.created_at?.slice?.(0, 16) || ""}</p>
              </article>
            ))}
          </div>
          <button onClick={() => setOpenNotifications(false)} className="mt-4 w-full rounded-2xl bg-blue-700 p-3 font-black text-white">{tx("Close", "ပိတ်ရန်")}</button>
        </section>
      )}

      <main><Outlet /></main>
    </div>
  );
}

export default Layout;
