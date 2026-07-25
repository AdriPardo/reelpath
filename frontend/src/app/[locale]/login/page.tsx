'use client';

import { FormEvent, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/BrandMark';
import { LEGAL_URLS, PLATFORM } from '@/lib/site-brand';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const { login } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell auth-shell-centered">
      <section className="auth-panel" aria-labelledby="login-heading">
        <div className="auth-panel-inner">
          <Link href="/" className="auth-brand-mark" aria-label={tn('homeAria', { appName: PLATFORM.name })}>
            <BrandMark size="lg" />
          </Link>

          <header className="auth-panel-header">
            <h2 id="login-heading">{t('loginTitle')}</h2>
            <p>{t('loginSubtitle')}</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="auth-alert" role="alert">
                <span className="auth-alert-icon" aria-hidden="true">!</span>
                <p>{error}</p>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor={emailId}>{tc('email')}</label>
              <input
                id={emailId}
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                autoComplete="email"
                autoFocus
                disabled={submitting}
              />
            </div>

            <div className="auth-field">
              <div className="auth-field-label-row">
                <label htmlFor={passwordId}>{tc('password')}</label>
              </div>
              <div className="auth-password-wrap">
                <input
                  id={passwordId}
                  data-testid="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tc('hidePassword') : tc('showPassword')}
                  tabIndex={-1}
                >
                  {showPassword ? tc('hide') : tc('show')}
                </button>
              </div>
            </div>

            <Button type="submit" className="auth-submit btn-block" disabled={submitting} data-testid="login-submit">
              {submitting ? t('loginSubmitting') : t('loginSubmit')}
            </Button>
          </form>

          <p className="auth-switch">
            {t('noAccount')}{' '}
            <Link href="/register">{t('createAccountLink')}</Link>
          </p>

          <footer className="auth-legal">
            <Link href={LEGAL_URLS.terms}>{tc('terms')}</Link>
            <span aria-hidden="true">·</span>
            <Link href={LEGAL_URLS.privacy}>{tc('privacy')}</Link>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${PLATFORM.contactEmail}`}>{tc('contact')}</a>
          </footer>
        </div>
      </section>
    </div>
  );
}
