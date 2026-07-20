import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { login as doLogin, register as doRegister, loginWithTikTokCode as doTikTokLogin, clearTokens, loadStoredAuth } from '@/lib/auth';
import { api, extractData, setSessionExpiredHandler } from '@/lib/api';
import { CreatorProfile, CreatorMeData, OnboardingPatch } from '@/types/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  profile: CreatorProfile | null;
  meData: CreatorMeData | null;
  credits: number;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (handle: string, email: string, password: string) => Promise<{ error: string | null }>;
  loginWithTikTok: (code: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  patchMe: (patch: OnboardingPatch) => Promise<{ error: string | null }>;
  setAuthenticated: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [meData, setMeData] = useState<CreatorMeData | null>(null);
  const fetchedOnce = useRef(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get('/creators/me');
      const d = extractData<CreatorMeData>(res);
      setMeData(d);
      setProfile(d?.profile ?? null);
    } catch (err: any) {
      // 401 is handled by the axios interceptor (token refresh / session expiry).
      // Any other failure leaves existing state in place — not fatal.
      console.warn('[AuthContext] fetchMe failed:', err?.response?.status, err?.message);
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAuthenticated(false);
      setProfile(null);
      setMeData(null);
    });
  }, []);

  // Hydrate auth state from SecureStore on launch, then load profile once.
  useEffect(() => {
    loadStoredAuth().then((authed) => {
      setAuthenticated(authed);
      setIsLoading(false);
      if (authed) {
        fetchedOnce.current = true;
        fetchMe();
      }
    });
  }, []);

  // Fetch profile when auth flips to true (login / register), but skip the
  // initial-load case that is already handled above to avoid a double call.
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (!fetchedOnce.current) {
        fetchedOnce.current = true;
        fetchMe();
      }
    }
    if (!isAuthenticated) fetchedOnce.current = false;
  }, [isAuthenticated]);

  const login = async (email: string, password: string) => {
    const result = await doLogin(email, password);
    if (result.error) return { error: result.error };
    setAuthenticated(true);
    return { error: null };
  };

  const register = async (handle: string, email: string, password: string) => {
    const result = await doRegister(handle, email, password);
    if (result.error) return { error: result.error };
    setAuthenticated(true);
    return { error: null };
  };

  const loginWithTikTok = async (code: string) => {
    const result = await doTikTokLogin(code);
    if (result.error) return { error: result.error };
    setAuthenticated(true);
    return { error: null };
  };

  const logout = async () => {
    await clearTokens();
    setAuthenticated(false);
    setProfile(null);
    setMeData(null);
  };

  const refreshMe = async () => { await fetchMe(); };

  const patchMe = async (patch: OnboardingPatch): Promise<{ error: string | null }> => {
    try {
      const res = await api.patch('/creators/me', patch);
      const d = extractData<{ profile: CreatorProfile }>(res);

      // Start from the values we just sent so the UI reflects the user's choice
      // even when the backend echoes unset columns back as null (which would
      // otherwise clobber the change and make it "disappear"). Then layer the
      // server's returned profile on top — but only its non-null fields.
      const next: Partial<CreatorProfile> = { ...patch };
      delete (next as any).complete;
      const serverProfile = (d?.profile ?? {}) as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(serverProfile)) {
        if (v !== null && v !== undefined) (next as any)[k] = v;
      }

      setProfile((prev) => ({ ...(prev ?? {} as CreatorProfile), ...next }));
      setMeData((prev) => prev ? { ...prev, profile: { ...(prev.profile ?? {}), ...next } } : prev);
      return { error: null };
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        ?? err?.response?.data?.message
        ?? 'Failed to save';
      return { error: typeof msg === 'string' ? msg : 'Failed to save' };
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, profile, meData,
      credits: profile?.ai_generations_remaining ?? 0,
      login, register, loginWithTikTok, logout, refreshMe, patchMe, setAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
