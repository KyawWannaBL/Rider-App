import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CircleDollarSign,
  Clock3,
  Globe2,
  Home,
  LogOut,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Route,
  UserRound,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { useAppState } from "../hooks/useAppState";
import { riderFeedback } from "../lib/riderFeedback";

type NotificationRow = Record<string, any>;

const navItems = [
  { to: "/dashboard", en: "Dashboard", my: "ပင်မ", icon: Home },
  { to: "/jobs", en: "Pickup", my: "Pickup", icon: PackageCheck },
  { to: "/route", en: "Route", my: "လမ်းကြောင်း", icon: MapPinned },
  { to: "/delivery", en: "Delivery", my: "ပို့ဆောင်", icon: Route },
  { to: "/cod-settlement", en: "COD", my: "COD", icon: CircleDollarSign },
  { to: "/history", en: "History", my: "မှတ်တမ်း", icon: Clock3 },
  { to: "/profile", en: "Profile", my: "ကိုယ်ရေး", icon: UserRound },
];

function desktopNavClass({ isActive }: { isActive: boolean }) {
  return [
    "group inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all duration-200",
    isActive
      ? "bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,.18)]"
      : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm",
  ].join(" ");
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return [
    "relative flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-black transition-all duration-200",
    isActive ? "text-blue-700" : "text-slate-500 active:bg-slate-100",
  ].join(" ");
}

export function Layout() {
  const navigate = useNavigate();
  const { language, toggleLanguage } = useAppState();
  const tx = (en: string, my: string) => (language === "my" ? my : en);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !(n.is_read || n.read_at)).length;
  const previousUnread = useRef(0);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const { data, error } = await (supabase as any).rpc("be_field_team_mobile_snapshot_v77", {
        p_payload: { notification_limit: 50 },
      });
      if (error) throw error;
      const next = Array.isArray(data?.notifications) ? data.notifications : [];
      const nextUnread = next.filter((n: any) => !(n.is_read || n.read_at)).length;
      if (previousUnread.current > 0 && nextUnread > previousUnread.current) riderFeedback("dispatch");
      previousUnread.current = nextUnread;
      setNotifications(next);
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

  useEffect(() => {
    void loadNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--be-bg)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 px-3 py-3 shadow-[0_8px_30px_rgba(15,23,42,.06)] backdrop-blur-2xl sm:px-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,.22)] v142-glow">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-300" />
                <span className="text-xl font-black tracking-tight">B</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.30em] text-blue-700">BRITIUM EXPRESS</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <h1 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">{tx("Rider App", "Rider အက်ပ်")}</h1>
                  <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 sm:inline-flex">
                    Live
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLanguage}
                className="be-icon-button v142-jelly"
                aria-label={tx("Switch language", "ဘာသာစကားပြောင်းရန်")}
                title={tx("Switch to Myanmar", "English သို့ပြောင်းရန်")}
              >
                <Globe2 className="h-5 w-5" />
                <span className="hidden text-xs font-black sm:inline">{language === "my" ? "EN" : "မြန်မာ"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenNotifications((value) => !value);
                  void loadNotifications();
                }}
                className="be-icon-button relative v142-jelly"
                aria-label={tx("Notifications", "အသိပေးချက်များ")}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={signOut}
                className="be-icon-button v142-jelly text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                aria-label={tx("Sign Out", "အကောင့်မှထွက်ရန်")}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="mt-3 hidden items-center gap-1 rounded-2xl bg-slate-100/80 p-1 lg:flex">
            {navItems.map(({ to, en, my, icon: Icon }) => (
              <NavLink key={to} to={to} className={desktopNavClass}>
                <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                {tx(en, my)}
              </NavLink>
            ))}
            <div className="ml-auto flex items-center gap-1 pr-1">
              <NavLink to="/availability" className={desktopNavClass}>{tx("Availability", "အလုပ်ဆင်းနိုင်မှု")}</NavLink>
              <NavLink to="/documents" className={desktopNavClass}>{tx("Documents", "စာရွက်စာတမ်း")}</NavLink>
              <NavLink to="/support" className={desktopNavClass}>{tx("Support", "အကူအညီ")}</NavLink>
            </div>
          </nav>
        </div>
      </header>

      {openNotifications && (
        <section className="fixed right-3 top-[76px] z-50 w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,.22)] backdrop-blur-2xl sm:right-4 sm:top-20">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Live Updates</p>
                <h2 className="mt-1 text-lg font-black">{tx("Notifications", "အသိပေးချက်များ")}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={loadingNotifications || unreadCount === 0}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20 disabled:opacity-40"
                  title={tx("Mark all read", "အားလုံးဖတ်ပြီးအဖြစ်သတ်မှတ်ရန်")}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  disabled={loadingNotifications}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 transition hover:bg-white/20"
                >
                  <RefreshCw className={["h-4 w-4", loadingNotifications ? "animate-spin" : ""].join(" ")} />
                </button>
              </div>
            </div>
          </div>

          <div className="be-scrollbar max-h-[62vh] space-y-2 overflow-y-auto p-3">
            {notifications.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-black text-slate-500">{tx("No notifications yet.", "အသိပေးချက်မရှိသေးပါ။")}</p>
              </div>
            )}

            {notifications.map((n, index) => {
              const unread = !(n.is_read || n.read_at);
              return (
                <article
                  key={n.id || index}
                  onClick={() => void markNotificationRead(n)}
                  className={[
                    "cursor-pointer rounded-2xl border p-4 transition-all duration-200",
                    unread
                      ? "border-blue-100 bg-amber-50/80 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                      : "border-slate-100 bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span className={["mt-1 h-2.5 w-2.5 shrink-0 rounded-full", unread ? "bg-[#d4af37]" : "bg-slate-300"].join(" ")} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-slate-950">{n.title || tx("Workflow notification", "လုပ်ငန်းစဉ်အသိပေးချက်")}</h3>
                      <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{n.message || "-"}</p>
                      <p className="mt-2 text-[11px] font-black text-slate-400">{n.pickup_id || ""} {n.created_at?.slice?.(0, 16) || ""}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="border-t border-slate-100 p-3">
            <button type="button" onClick={() => setOpenNotifications(false)} className="be-secondary-button w-full">
              {tx("Close", "ပိတ်ရန်")}
            </button>
          </div>
        </section>
      )}

      <main className="pb-[92px] lg:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 rounded-[26px] border border-white/70 bg-white/92 p-1.5 shadow-[0_22px_60px_rgba(15,23,42,.20)] backdrop-blur-2xl lg:hidden">
        <div className="flex items-stretch gap-0.5 overflow-x-auto">
          {navItems.map(({ to, en, my, icon: Icon }) => (
            <NavLink key={to} to={to} className={mobileNavClass}>
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-blue-600" />}
                  <span className={["grid h-8 w-8 place-items-center rounded-xl transition-all", isActive ? "bg-blue-50" : ""].join(" ")}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="max-w-[64px] truncate">{tx(en, my)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default Layout;
