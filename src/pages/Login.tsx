import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("sai@britiumexpress.com");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("Signing in...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Login successful.");
    navigate("/jobs", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[0.35em] text-blue-600">
          BRITIUM EXPRESS
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Rider App Login</h1>
        <p className="mt-2 font-semibold text-slate-600">
          Sign in to open pickup verification, cargo photo capture, QR printing, and notifications.
        </p>

        <form onSubmit={login} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-black uppercase text-slate-500">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold outline-none focus:border-blue-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-black uppercase text-slate-500">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold outline-none focus:border-blue-600"
            />
          </label>

          {message && (
            <div className="rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
              {message}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-blue-700 px-5 py-4 font-black text-white disabled:opacity-60"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
