// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { User, setAuth, clearAuth, getUser, isAuthenticated } from '@/lib/auth';
import { supabaseAuth, describeAuthError } from '@/lib/supabase';
import { debugLog } from '@/lib/debug';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => boolean;
  refreshUser: () => Promise<User | undefined>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  checkAuth: () => false,
  refreshUser: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

/** Home screen for each role. */
export const homeFor = (role?: string) =>
  role === 'superadmin' ? '/platform-admin/dashboard' : role === 'admin' ? '/org-admin/dashboard' : '/client-dashboard/dashboard';

/** Normalise the profile from the API into the User shape the rest of the app uses. */
const toUser = (data: any): User => {
  const organizationId =
    data.organizationId ||
    (typeof data.organization === 'string' ? data.organization : data.organization?._id || data.organization?.id) ||
    undefined;

  if (organizationId && typeof window !== 'undefined') {
    localStorage.setItem('syntropi_org_id', organizationId);
  }

  return {
    id: data.id || data._id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    organizationId,
    organization: data.organization,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const loadingProfile = useRef<Promise<User | undefined> | null>(null);

  /** Load the profile for the current session. Concurrent calls share one request. */
  const loadProfile = useCallback(async (accessToken: string): Promise<User | undefined> => {
    if (loadingProfile.current) return loadingProfile.current;

    const request = (async () => {
      try {
        // Make the token available to the API client before the first call
        setAuth(accessToken, getUser() ?? ({} as User));
        const response = await authAPI.me();
        const profile = toUser(response.data.data.user);
        setAuth(accessToken, profile);
        setUser(profile);
        return profile;
      } catch (error) {
        debugLog('AuthContext', 'Could not load profile', { error }, true);
        throw error;
      } finally {
        loadingProfile.current = null;
      }
    })();

    loadingProfile.current = request;
    return request;
  }, []);

  // Restore the session on first load, then follow sign-in, refresh and sign-out events.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data } = await supabaseAuth.getSession();
        if (data.session) {
          // Show the stored profile straight away, then confirm it with the server
          const stored = getUser();
          if (stored && !cancelled) setUser(stored);
          await loadProfile(data.session.access_token);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();

    const { data: listener } = supabaseAuth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAuth();
        setUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Keep the stored token current. The profile has not changed.
        setAuth(session.access_token, getUser() ?? ({} as User));
      } else if (event === 'SIGNED_IN' && session && !loadingProfile.current) {
        // Also fires when an email confirmation link signs the user in
        loadProfile(session.access_token)
          .then((profile) => {
            if (profile && window.location.pathname.match(/^\/(login|signup)?$/)) router.push(homeFor(profile.role));
          })
          .catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, router]);

  const refreshUser = async () => {
    const { data } = await supabaseAuth.getSession();
    if (!data.session) return undefined;
    return loadProfile(data.session.access_token);
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabaseAuth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new Error(error ? describeAuthError(error) : 'Sign in failed. Try again.');
    }

    let profile: User | undefined;
    try {
      profile = await loadProfile(data.session.access_token);
    } catch (profileError: any) {
      // Signed in with Supabase but has no Syntropi profile (or it is inactive)
      await supabaseAuth.signOut();
      clearAuth();
      const message = profileError?.response?.data?.error?.message;
      throw new Error(
        profileError?.response?.status === 403 || profileError?.response?.status === 401
          ? message || 'This account can’t use Syntropi yet. Contact your administrator.'
          : 'We couldn’t load your account. Try again.',
      );
    }

    router.push(homeFor(profile?.role));
  };

  const logout = () => {
    supabaseAuth.signOut().finally(() => {
      clearAuth();
      setUser(null);
      router.push('/login');
    });
  };

  const checkAuth = () => {
    const isAuth = isAuthenticated();
    if (!isAuth && user) {
      setUser(null);
    }
    return isAuth;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
