'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SkeletonHeader, SkeletonStats } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/user-messages';
import { clearToken, isAuthRequired, setToken } from '@/lib/auth';
import { API_URL } from '@/lib/api-url';
import { isPublicPath } from '@/lib/public-paths';
import type { AppLocale } from '@/i18n/routing';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  locale: 'es' | 'en';
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planLimits?: Record<string, unknown> | null;
  trialEndsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingStatus?: 'active' | 'past_due' | 'canceled' | null;
  subscriptionRenewsAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  organization: AuthOrganization;
  role: string;
  isPlatformAdmin?: boolean;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUserLocale: (locale: AppLocale) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserLocale(locale: string | null | undefined): AppLocale {
  return locale === 'en' ? 'en' : 'es';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as AppLocale;
  const t = useTranslations('auth');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<AuthSession>('/api/auth/me');
      setSession(data);
    } catch {
      clearToken();
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || !session?.user.locale) return;
    const preferred = normalizeUserLocale(session.user.locale);
    if (preferred !== locale) {
      router.replace(pathname, { locale: preferred });
    }
  }, [loading, session?.user.locale, locale, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = parseApiError(text, t('loginInvalid'), locale as 'es' | 'en');
        throw new Error(message);
      }
      const data = (await res.json()) as { token: string } & AuthSession;
      setToken(data.token);
      setSession({
        user: data.user,
        organization: data.organization,
        role: data.role,
        isPlatformAdmin: data.isPlatformAdmin === true,
      });
      const userLocale = normalizeUserLocale(data.user.locale);
      router.push('/', { locale: userLocale });
      router.refresh();
    },
    [router, t, locale],
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      name?: string;
    }) => {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          locale,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = parseApiError(text, t('registerFailed'), locale as 'es' | 'en');
        throw new Error(message);
      }
      const result = (await res.json()) as { token: string } & AuthSession;
      setToken(result.token);
      setSession({
        user: result.user,
        organization: result.organization,
        role: result.role,
        isPlatformAdmin: result.isPlatformAdmin === true,
      });
      const userLocale = normalizeUserLocale(result.user.locale);
      router.push('/', { locale: userLocale });
      router.refresh();
    },
    [router, t, locale],
  );

  const logout = useCallback(() => {
    void fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
    clearToken();
    setSession(null);
    router.push('/login');
    router.refresh();
  }, [router]);

  const setUserLocale = useCallback((next: AppLocale) => {
    setSession((prev) =>
      prev ? { ...prev, user: { ...prev.user, locale: next } } : prev,
    );
  }, []);

  const value = useMemo(
    () => ({ session, loading, login, register, logout, refresh, setUserLocale }),
    [session, loading, login, register, logout, refresh, setUserLocale],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');
  const publicRoute = isPublicPath(pathname ?? '');

  useEffect(() => {
    if (!isAuthRequired() || publicRoute) return;
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [loading, session, router, publicRoute]);

  if (publicRoute) {
    return <>{children}</>;
  }

  if (isAuthRequired() && loading) {
    return (
      <div className="page-content" aria-busy="true" aria-label={t('loadingSession')}>
        <SkeletonHeader />
        <SkeletonStats count={3} />
      </div>
    );
  }

  if (isAuthRequired() && !session) {
    return null;
  }

  return <>{children}</>;
}
