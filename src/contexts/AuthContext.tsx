import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";

type AuthContextValue = {
  user: any | null;
  session: any | null;
  profile: any | null;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  authError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); }
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  const hydrateProfile = useCallback(async (nextSession: any | null, source: string) => {
    const requestId = ++requestRef.current;
    const currentUser = nextSession?.user;

    if (!currentUser?.id) {
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      setProfile(null);
      setAuthError(null);
      setLoading(false);
      return null;
    }

    try {
      const result: any = await withTimeout(
        (supabase as any).rpc("be_rider_profile_snapshot"),
        8000,
        "Enterprise profile"
      );
      if (!mountedRef.current || requestId !== requestRef.current) return null;

      if (result?.error || result?.data?.ok === false) {
        setProfile(null);
        setAuthError(result?.error?.message || result?.data?.error || "Enterprise profile is not approved yet.");
      } else {
        setProfile(result?.data || null);
        setAuthError(null);
      }
      return result?.data || null;
    } catch (error: any) {
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      console.error(`Rider auth profile hydration failed (${source})`, error);
      setProfile(null);
      setAuthError(error?.message || "Unable to load Enterprise profile.");
      return null;
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    await hydrateProfile(session, "manual-refresh");
  }, [hydrateProfile, session]);

  useEffect(() => {
    mountedRef.current = true;
    let bootstrapFinished = false;

    // Absolute fail-safe: never leave a field user on the splash indefinitely.
    const watchdog = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
      setAuthError((current) => current || "Authentication check timed out. Please sign in again.");
    }, 10000);

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return;

      setSession(nextSession);
      setUser(nextSession?.user || null);

      if (!nextSession?.user) {
        requestRef.current += 1;
        setProfile(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      // IMPORTANT: never await Supabase RPCs inside onAuthStateChange.
      // The callback must return immediately or auth's internal lock can stall.
      if (event !== "INITIAL_SESSION" || bootstrapFinished) {
        setLoading(true);
        window.setTimeout(() => {
          if (mountedRef.current) void hydrateProfile(nextSession, `auth-event:${event}`);
        }, 0);
      }
    });

    void (async () => {
      try {
        const result: any = await withTimeout(supabase.auth.getSession(), 5000, "Session check");
        if (!mountedRef.current) return;
        const nextSession = result?.data?.session || null;
        setSession(nextSession);
        setUser(nextSession?.user || null);

        if (nextSession?.user) {
          setLoading(true);
          await hydrateProfile(nextSession, "bootstrap");
        } else {
          setProfile(null);
          setAuthError(null);
          setLoading(false);
        }
      } catch (error: any) {
        if (!mountedRef.current) return;
        console.error("Rider auth bootstrap failed", error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthError(error?.message || "Authentication check failed.");
        setLoading(false);
      } finally {
        bootstrapFinished = true;
        window.clearTimeout(watchdog);
      }
    })();

    return () => {
      mountedRef.current = false;
      window.clearTimeout(watchdog);
      listener.subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      authError,
      signOut: async () => {
        requestRef.current += 1;
        try {
          await withTimeout(supabase.auth.signOut(), 5000, "Sign out");
        } finally {
          if (mountedRef.current) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setAuthError(null);
            setLoading(false);
          }
        }
      },
      refreshProfile,
    }),
    [user, session, profile, loading, authError, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
