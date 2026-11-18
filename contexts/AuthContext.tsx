'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { User } from '@/types';
import ConnectionNotice from '@/components/layout/ConnectionNotice';
import { unavailableAuthMessage } from '@/lib/auth/error-body';
import {
  fetchAuthSession,
  postLogin,
  postLogout,
  postRegister,
} from '@/lib/api/auth';
import {
  readPushToken,
  storeNotificationLocale,
  storePushToken,
} from '@/lib/push/storage';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /**
   * True until the backend session has been read. It stays true while the
   * server can't be reached, so pages wait instead of sending a signed-in
   * visitor to sign in.
   */
  isAuthLoading: boolean;
 login: (
  email: string,
  password: string,
  remember: boolean,
  acceptPolicies: boolean,
) => Promise<AuthResult>;
  register: (data: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<{ ok: boolean; unavailable?: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Waits before checking the session again while the server can't be reached. */
const SESSION_RETRY_MS = [3_000, 6_000, 12_000];
const SESSION_RETRY_MAX_MS = 20_000;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  // The session route answered 503 (or didn't answer): the sign-in cookies are
  // kept, we just don't know who the visitor is yet. Not the same as signed out.
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionFailuresRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const retryLater = () => {
      const delay =
        SESSION_RETRY_MS[sessionFailuresRef.current] ?? SESSION_RETRY_MAX_MS;
      sessionFailuresRef.current += 1;
      setAuthUnavailable(true);
      retryTimer = setTimeout(() => setSessionAttempt((n) => n + 1), delay);
    };

    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        if (session.unavailable) {
          retryLater();
          return;
        }
        sessionFailuresRef.current = 0;
        setUser(session.user);
        setAuthUnavailable(false);
        setIsAuthLoading(false);
      })
      .catch((error: unknown) => {
        console.error(
          'Auth session request failed',
          error instanceof Error ? error.name : 'unknown',
        );
        if (!cancelled) retryLater();
      });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [sessionAttempt]);

  const retrySessionNow = useCallback(() => {
    setSessionAttempt((n) => n + 1);
  }, []);

  /** A sign-in or sign-up answered, so the visitor is known now. */
  const settleSession = useCallback((next: User | null) => {
    sessionFailuresRef.current = 0;
    setUser(next);
    setAuthUnavailable(false);
    setIsAuthLoading(false);
  }, []);

const login = useCallback(
  async (
    email: string,
    password: string,
    remember: boolean,
    acceptPolicies: boolean,
  ): Promise<AuthResult> => {
    try {
      const result = await postLogin(
        email,
        password,
        remember,
        acceptPolicies,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      settleSession(result.user);
      return { success: true };
    } catch (error) {
      console.error(
        'Login request failed',
        error instanceof Error ? error.name : 'unknown',
      );

      return {
        success: false,
        error: unavailableAuthMessage(),
      };
    }
  },
  [settleSession],
);

  const register = useCallback(
    async (data: RegisterInput): Promise<AuthResult> => {
      try {
        const result = await postRegister(data);
        if (!result.success) {
          return { success: false, error: result.error };
        }
        settleSession(result.user);
        return { success: true };
      } catch (error) {
        console.error(
          'Register request failed',
          error instanceof Error ? error.name : 'unknown',
        );
        return {
          success: false,
          error: unavailableAuthMessage(),
        };
      }
    },
    [settleSession],
  );

  const logout = useCallback(async () => {
    const pushToken = readPushToken();
    storePushToken(null);
    storeNotificationLocale(null);
    try {
      await postLogout(pushToken);
    } catch (error) {
      console.error(
        'Logout request failed',
        error instanceof Error ? error.name : 'unknown',
      );
    }
    setUser(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<{
    ok: boolean;
    unavailable?: boolean;
  }> => {
    try {
      const session = await fetchAuthSession();
      if (session.unavailable) {
        return { ok: false, unavailable: true };
      }
      setUser(session.user);
      return { ok: true };
    } catch (error) {
      console.error(
        'Auth session refresh failed',
        error instanceof Error ? error.name : 'unknown',
      );
      return { ok: false, unavailable: true };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthLoading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
      {authUnavailable && isAuthLoading ? (
        <ConnectionNotice onRetry={retrySessionNow} />
      ) : null}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
