'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function SettingsAccountPanel() {
  const t = useTranslations('settings.account');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const { session, loading, logout, refresh } = useAuth();
  const { toast } = useToast();
  const nameId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(session?.user.name ?? '');
  }, [session?.user.name]);

  if (loading) {
    return (
      <section className="settings-section">
        <header className="settings-section-header">
          <h2>{t('title')}</h2>
        </header>
        <p className="text-muted text-sm">{tc('loading')}</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="settings-section">
        <header className="settings-section-header">
          <h2>{t('title')}</h2>
        </header>
        <p className="text-muted text-sm">{t('loginRequired')}</p>
      </section>
    );
  }

  const savedName = session.user.name ?? '';
  const nameUnchanged = name.trim() === savedName.trim();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      await refresh();
      toast(t('nameUpdated'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('nameSaveError'), 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast(t('passwordMismatch'), 'error');
      return;
    }
    setChangingPassword(true);
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword, currentPassword }),
      });
      toast(t('passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('passwordChangeError'), 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  function closePasswordForm() {
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>

      <form className="settings-form-block" onSubmit={saveName}>
        <label className="modal-field" htmlFor={nameId}>
          {t('displayName')}
          <input
            id={nameId}
            type="text"
            className="topic-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={ta('namePlaceholder')}
            maxLength={120}
          />
        </label>
        <div className="settings-form-actions">
          <Button type="submit" variant="primary" size="sm" disabled={savingName || nameUnchanged}>
            {savingName ? tc('saving') : tc('saveChanges')}
          </Button>
          {!nameUnchanged && !savingName && (
            <span className="settings-inline-hint">{t('unsavedChanges')}</span>
          )}
        </div>
      </form>

      <div className="settings-divider" />

      <div className="settings-subsection">
        <div className="settings-subsection-head">
          <div>
            <h3>{t('passwordSection')}</h3>
            <p className="text-muted text-sm">{t('passwordHint')}</p>
          </div>
          {!showPasswordForm && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowPasswordForm(true)}>
              {t('changePassword')}
            </Button>
          )}
        </div>

        {showPasswordForm && (
          <form className="settings-password-panel" onSubmit={changePassword}>
            <label className="modal-field" htmlFor={currentPasswordId}>
              {t('currentPassword')}
              <input
                id={currentPasswordId}
                type="password"
                className="topic-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label className="modal-field" htmlFor={newPasswordId}>
              {t('newPassword')}
              <input
                id={newPasswordId}
                type="password"
                className="topic-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label className="modal-field" htmlFor={confirmPasswordId}>
              {t('confirmPassword')}
              <input
                id={confirmPasswordId}
                type="password"
                className="topic-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <div className="settings-form-actions">
              <Button type="submit" variant="primary" size="sm" disabled={changingPassword}>
                {changingPassword ? tc('saving') : t('updatePassword')}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={changingPassword} onClick={closePasswordForm}>
                {tc('cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="settings-divider" />

      <div className="settings-subsection settings-logout-row">
        <div>
          <h3>{t('sessionSection')}</h3>
          <p className="text-muted text-sm">{t('sessionHint')}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => logout()}>
          {t('logout')}
        </Button>
      </div>
    </section>
  );
}
