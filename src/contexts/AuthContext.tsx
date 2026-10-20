import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { enterpriseProfileOverlay } from "@/lib/enterpriseProfileOverlay";

export type EnterpriseProfileState = "checking" | "approved" | "unapproved" | "error";

type AuthContextValue = {
  user: any | null;
  session: any | null;
  profile: any | null;
  profileState: EnterpriseProfileState;
  loading: boolean;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  profileState: "checking",
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

function isUnapprovedError(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42501" || message.includes("not mapped to an active field-team account");
}

function isTransientConnectionError(error: any) {
  const code = String(error?.code || "");
  // Explicit auth, database and HTTP failures must still remove approval.
  if (Number(error?.status) >= 400 || (code && !["ETIMEDOUT", "ECONNRESET", "ENETUNREACH", "ERR_NETWORK", "NETWORK_ERR"].includes(code))) return false;
  return /failed to fetch|networkerror|load failed|timed out/i.test(String(error?.message || error || ""));
}

function normalizeNetworkMessage(error: any) {
  const raw = String(error?.message || error || "");
  if (/failed to fetch|networkerror|load failed|timed out/i.test(raw)) {
    return "Unable to connect to Britium Enterprise. Check internet connection and try again.";
  }
  return raw || "Unable to load Enterprise profile.";
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 700): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((resolve) => window.setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastError;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileState, setProfileState] = useState<EnterpriseProfileState>("checking");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const approvedUserIdRef = useRef<string | null>(null);

  const hydrateProfile = useCallback(async (nextSession: any | null, source: string, background = false) => {
    const requestId = ++requestRef.current;
    const currentUser = nextSession?.user;

    if (!currentUser?.id) {
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      setProfile(null);
      setProfileState("checking");
      setAuthError(null);
      setLoading(false);
      return null;
    }

    if (!background) {
      setProfileState("checking");
      setAuthError(null);
    }

    try {
      const result: any = await retry(async () => {
        const rpcResult: any = await withTimeout(
          (supabase as any).rpc(currentUser.email?.toLowerCase() === "rideradmin@britiumexpress.com" ? "be_rider_admin_profile_snapshot_v1" : "be_rider_profile_snapshot"),
          8000,
          "Enterprise profile"
        );
        if (rpcResult?.error) {
          if (isUnapprovedError(rpcResult.error)) return rpcResult;
          throw rpcResult.error;
        }
        return rpcResult;
      });

      if (!mountedRef.current || requestId !== requestRef.current) return null;

      if (result?.error && isUnapprovedError(result.error)) {
        setProfile(null);
        setProfileState("unapproved");
        setAuthError(null);
        return null;
      }

      if (result?.data?.ok === false) {
        setProfile(null);
        setProfileState("error");
        setAuthError(result.data?.error || "Enterprise profile check failed.");
        return null;
      }

      const synchronizedProfile = await enterpriseProfileOverlay(result?.data || {});
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      approvedUserIdRef.current = currentUser.id;
      setProfile(synchronizedProfile);
      setProfileState("approved");
      setAuthError(null);
      return synchronizedProfile;
    } catch (error: any) {
      if (!mountedRef.current || requestId !== requestRef.current) return null;
      console.error(`Rider Enterprise profile hydration failed (${source})`, error);
      if (background && activeUserIdRef.current === currentUser.id && approvedUserIdRef.current === currentUser.id && isTransientConnectionError(error)) {
        // A temporary connection loss on app resume must not discard staged
        // operational evidence. Explicit denial and login failures still block.
        setAuthError(normalizeNetworkMessage(error));
        return null;
      }
      setProfile(null);
      setProfileState("error");
      setAuthError(normalizeNetworkMessage(error));
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
    let authSubscription: any = null;

    const watchdog = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
      setProfileState((state) => state === "checking" ? "error" : state);
      setAuthError((current) => current || "Enterprise connection timed out. Please retry.");
    }, 12000);

    const handleAuthEvent = (event: string, nextSession: any | null) => {
      if (!mountedRef.current) return;

      const nextUserId = nextSession?.user?.id || null;
      const sameUser = activeUserIdRef.current === nextUserId;
      activeUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user || null);

      if (!sameUser) {
        requestRef.current += 1;
        approvedUserIdRef.current = null;
        setProfile(null);
        setProfileState("checking");
      }

      if (!nextSession?.user) {
        requestRef.current += 1;
        setProfile(null);
        setProfileState("checking");
        setAuthError(null);
        setLoading(false);
        return;
      }

      // Token refreshes should never throw the whole UI back onto the splash.
      if (event === "TOKEN_REFRESHED" && sameUser) return;

      // Supabase emits SIGNED_IN again on foreground resume. Keep drafts and
      // photo evidence mounted while rechecking the same approved identity.
      const background = sameUser && approvedUserIdRef.current === nextUserId;
      if (!background) setLoading(true);
      const scheduledRequest = requestRef.current;
      window.setTimeout(() => {
        if (mountedRef.current && activeUserIdRef.current === nextUserId && requestRef.current === scheduledRequest) {
          void hydrateProfile(nextSession, `auth-event:${event}`, background);
        }
      }, 0);
    };

    void (async () => {
      try {
        // Bootstrap is the single owner of initial auth state. Do not subscribe
        // until it has fully settled; this prevents INITIAL_SESSION/SIGNED_IN
        // callbacks from racing getSession() and cancelling profile hydration.
        const result: any = await withTimeout(supabase.auth.getSession(), 5000, "Session check");
        if (!mountedRef.current) return;

        const nextSession = result?.data?.session || null;
        activeUserIdRef.current = nextSession?.user?.id || null;
        setSession(nextSession);
        setUser(nextSession?.user || null);

        if (nextSession?.user) {
          setLoading(true);
          await hydrateProfile(nextSession, "bootstrap");
        } else {
          setProfile(null);
          setProfileState("checking");
          setAuthError(null);
          setLoading(false);
        }
      } catch (error: any) {
        if (!mountedRef.current) return;
        console.error("Rider auth bootstrap failed", error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileState("error");
        setAuthError(normalizeNetworkMessage(error));
        setLoading(false);
      } finally {
        window.clearTimeout(watchdog);
        if (mountedRef.current) {
          const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
            handleAuthEvent(event, nextSession);
          });
          authSubscription = data?.subscription || null;
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      window.clearTimeout(watchdog);
      authSubscription?.unsubscribe?.();
    };
  }, [hydrateProfile]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      profileState,
      loading,
      authError,
      signOut: async () => {
        requestRef.current += 1;
        activeUserIdRef.current = null;
        approvedUserIdRef.current = null;
        try {
          await withTimeout(supabase.auth.signOut(), 5000, "Sign out");
        } finally {
          if (mountedRef.current) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfileState("checking");
            setAuthError(null);
            setLoading(false);
          }
        }
      },
      refreshProfile,
    }),
    [user, session, profile, profileState, loading, authError, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
