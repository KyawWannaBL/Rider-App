import { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Headphones, Home, PackageCheck, UserRound, WalletCards } from "lucide-react";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Jobs", href: "/delivery", icon: PackageCheck },
  { label: "Wallet", href: "/wallet", icon: WalletCards },
  { label: "Support", href: "/support", icon: Headphones },
  { label: "Profile", href: "/profile", icon: UserRound },
];

export default function RiderMobileShellV2({ children, riderName = "Rider", online = true }: PropsWithChildren<{ riderName?: string; online?: boolean }>) {
  const { pathname } = useLocation();
  return (
    <div className="be-rider-safe-area min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/92 px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Britium Express</p><h1 className="mt-1 text-2xl font-black">{riderName}</h1></div>
          <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${online ? "bg-emerald-400 text-slate-950" : "bg-slate-700 text-white"}`}>{online ? "ONLINE" : "OFFLINE"}</span><button className="be-rider-tap grid place-items-center rounded-2xl bg-white/10"><Bell className="h-6 w-6" /></button></div>
        </div>
      </header>
      <main className="p-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[1.65rem] bg-white/8 p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return <Link key={tab.href} to={tab.href} className={["be-rider-tap flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition", active ? "bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(34,211,238,.24)]" : "text-slate-300 hover:bg-white/10"].join(" ")}><Icon className="h-5 w-5" />{tab.label}</Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
