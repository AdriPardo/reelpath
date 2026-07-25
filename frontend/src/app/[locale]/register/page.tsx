'use client';

import { FormEvent, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/BrandMark';
import { LEGAL_URLS, PLATFORM } from '@/lib/site-brand';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const { register } = useAuth();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [name, setName] = useState('');
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
      await register({
        email,
        password,
        name: name.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell auth-shell-centered">
      <section className="auth-panel" aria-labelledby="register-heading">
        <div className="auth-panel-inner">
          <Link href="/" className="auth-brand-mark" aria-label={tn('homeAria', { appName: PLATFORM.name })}>
            <BrandMark size="lg" />
          </Link>

          <header className="auth-panel-header">
            <h2 id="register-heading">{t('registerTitle')}</h2>
            <p>{t('registerSubtitle')}</p>
          </header>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="auth-alert" role="alert" aria-live="polite">
                <span className="auth-alert-icon" aria-hidden="true">!</span>
                <p>{error}</p>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor={nameId}>{tc('name')}</label>
              <input
                id={nameId}
                data-testid="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoComplete="name"
                autoFocus
                disabled={submitting}
              />
            </div>

            <div className="auth-field">
              <label htmlFor={emailId}>{tc('email')}</label>
              <input
                id={emailId}
                data-testid="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('registerEmailPlaceholder')}
                required
                autoComplete="email"
                disabled={submitting}
              />
            </div>

            <div className="auth-field">
              <label htmlFor={passwordId}>{tc('password')}</label>
              <div className="auth-password-wrap">
                <input
                  id={passwordId}
                  data-testid="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordMinPlaceholder')}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tc('hidePassword') : tc('showPassword')}
                >
                  {showPassword ? tc('hide') : tc('show')}
                </button>
              </div>
            </div>

            <Button type="submit" className="auth-submit btn-block" disabled={submitting} data-testid="register-submit">
              {submitting ? t('registerSubmitting') : t('registerSubmit')}
            </Button>
          </form>

          <p className="auth-switch">
            {t('hasAccount')}{' '}
            <Link href="/login">{t('loginLink')}</Link>
          </p>

          <footer className="auth-legal">
            <Link href={LEGAL_URLS.terms}>{tc('terms')}</Link>
            <span aria-hidden="true">·</span>
            <Link href={LEGAL_URLS.privacy}>{tc('privacy')}</Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
