import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black tracking-[0.35em] text-blue-600">
            BRITIUM EXPRESS
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Rider Dashboard
          </h1>
          <p className="mt-2 font-semibold text-slate-600">
            Pickup verification, cargo photo capture, temporary QR printing, and parcel saving.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/jobs"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50"
          >
            <h2 className="text-xl font-black text-slate-950">Pickup Verification</h2>
            <p className="mt-2 font-semibold text-slate-600">
              Open assigned pickups, capture cargo photos, save parcels, and print QR codes.
            </p>
          </Link>

          <Link
            to="/history"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-blue-50"
          >
            <h2 className="text-xl font-black text-slate-950">History</h2>
            <p className="mt-2 font-semibold text-slate-600">
              View completed pickup and delivery records.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
}
