import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

type AuthContextValue = {
  user: any | null;
  session: any | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadEnterpriseProfile(nextSession?: any | null) {
    const activeSession = nextSession ?? session;
    const currentUser = activeSession?.user || user;
    if (!currentUser?.id) {
      setProfile(null);
      return null;
    }

    const { data, error } = await (supabase as any).rpc("be_rider_profile_snapshot");
    if (error || data?.ok === false) {
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  }

  async function refreshProfile() {
    setLoading(true);
    try {
      await loadEnterpriseProfile();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      if (data.session?.user) {
        const { data: profileData, error } = await (supabase as any).rpc("be_rider_profile_snapshot");
        if (!mounted) return;
        setProfile(error || profileData?.ok === false ? null : profileData);
      } else {
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user || null);
      if (nextSession?.user) {
        const { data: profileData, error } = await (supabase as any).rpc("be_rider_profile_snapshot");
        setProfile(error || profileData?.ok === false ? null : profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      },
      refreshProfile,
    }),
    [user, session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
