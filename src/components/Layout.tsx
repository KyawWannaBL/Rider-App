import { useEffect, useState } from "react";
import { Bell, LogOut, RefreshCw } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

type NotificationRow = {
  id?: string;
  title?: string;
  message?: string;
  target_role?: string;
  pickup_id?: string;
  event_type?: string;
  created_at?: string;
  read_at?: string | null;
  metadata?: any;
};

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
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function loadNotifications() {
    setLoadingNotifications(true);
    setNotificationMessage("");

    const { data, error } = await (supabase as any)
      .from("be_app_notifications")
      .select("*")
      .or("target_role.eq.rider,target_role.eq.driver,target_role.eq.helper,target_role.eq.mobile,target_role.eq.general")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Notification load failed", error);
      setNotificationMessage(`Notification load failed: ${error.message}`);
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setNotifications(data || []);
    setLoadingNotifications(false);
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => n.id && !n.read_at).map((n) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await (supabase as any)
      .from("be_app_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    if (error) {
      console.error("Mark read failed", error);
      setNotificationMessage(`Mark read failed: ${error.message}`);
      return;
    }

    await loadNotifications();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("rider-app-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "be_app_notifications",
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
              type="button"
              onClick={() => {
                setOpenNotifications((current) => !current);
                loadNotifications();
              }}
              className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </span>

              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={signOut}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700 hover:bg-rose-100"
            >
              <span className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </span>
            </button>
          </nav>
        </div>
      </header>

      {openNotifications && (
        <section className="fixed right-4 top-24 z-40 w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Notifications</h2>
              <p className="text-sm font-bold text-slate-500">
                Supervisor assignments, pickup updates, and workflow alerts.
              </p>
            </div>

            <button
              onClick={loadNotifications}
              disabled={loadingNotifications}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {notificationMessage && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
              {notificationMessage}
            </div>
          )}

          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {notifications.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-black text-slate-500">
                No notifications yet.
              </div>
            )}

            {notifications.map((notification, index) => (
              <article
                key={notification.id || index}
                className={`rounded-2xl border p-4 ${
                  notification.read_at
                    ? "border-slate-200 bg-white"
                    : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">
                      {notification.title || "Workflow notification"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {notification.message || "-"}
                    </p>
                  </div>

                  {!notification.read_at && (
                    <span className="rounded-full bg-blue-700 px-2 py-1 text-xs font-black text-white">
                      New
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-500">
                  {notification.pickup_id && <span>{notification.pickup_id}</span>}
                  {notification.event_type && <span>{notification.event_type}</span>}
                  {notification.created_at && <span>{notification.created_at.slice(0, 16)}</span>}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={markAllRead}
              className="rounded-2xl bg-blue-700 px-4 py-3 text-sm font-black text-white"
            >
              Mark All Read
            </button>
            <button
              onClick={() => setOpenNotifications(false)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
            >
              Close
            </button>
          </div>
        </section>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
