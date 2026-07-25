'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

interface OrgMember {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function SettingsTeamPanel() {
  const t = useTranslations('settings.team');
  const tc = useTranslations('common');
  const { session } = useAuth();
  const { toast } = useToast();
  const emailId = useId();
  const purgeId = useId();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purging, setPurging] = useState(false);

  const isAdmin = session?.role === 'owner' || session?.role === 'admin';

  async function loadTeam() {
    setLoading(true);
    try {
      const data = await api<{ members: OrgMember[]; pendingInvites: PendingInvite[] }>(
        '/api/org/members',
      );
      setMembers(data.members);
      setInvites(data.pendingInvites);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const result = await api<{ status: string; message: string; inviteUrl?: string }>(
        '/api/org/invites',
        {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), role }),
        },
      );
      toast(result.message, 'success');
      if (result.inviteUrl) {
        console.info('[invite] URL de desarrollo:', result.inviteUrl);
      }
      setEmail('');
      await loadTeam();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('inviteError'), 'error');
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(id: string) {
    try {
      await api(`/api/org/invites/${id}`, { method: 'DELETE' });
      toast(t('inviteCancelled'), 'success');
      await loadTeam();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('cancelError'), 'error');
    }
  }

  async function purgeOrgContent() {
    if (purgeConfirm.trim() !== 'DELETE_ORG_CONTENT') {
      toast(t('purgeConfirmError'), 'error');
      return;
    }
    setPurging(true);
    try {
      const result = await api<{ ok: boolean; deletedChannels: number }>(`/api/org/purge`, {
        method: 'POST',
        body: JSON.stringify({ confirmation: purgeConfirm.trim() }),
      });
      toast(t('purgeSuccess', { count: result.deletedChannels }), 'success');
      setPurgeOpen(false);
      setPurgeConfirm('');
      await loadTeam();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('purgeError'), 'error');
    } finally {
      setPurging(false);
    }
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

  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <h2>{t('title')}</h2>
        <p className="settings-section-desc">{t('description')}</p>
      </header>

      {isAdmin && (
        <form className="settings-form-block" onSubmit={sendInvite}>
          <label className="modal-field" htmlFor={emailId}>
            {t('emailLabel')}
            <input
              id={emailId}
              type="email"
              className="topic-input"
              data-testid="team-invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@empresa.com"
              required
            />
          </label>
          <label className="modal-field">
            {t('roleLabel')}
            <select
              className="topic-input"
              data-testid="team-invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            >
              <option value="member">{t('roleMember')}</option>
              <option value="admin">{t('roleAdmin')}</option>
            </select>
          </label>
          <div className="settings-form-actions">
            <Button type="submit" variant="primary" size="sm" disabled={inviting} data-testid="team-invite-submit">
              {inviting ? t('sending') : t('invite')}
            </Button>
          </div>
        </form>
      )}

      <div className="settings-divider" />

      <div className="settings-subsection">
        <h3>{t('members')}</h3>
        {loading ? (
          <p className="text-muted text-sm">{tc('loading')}</p>
        ) : members.length === 0 ? (
          <p className="text-muted text-sm">{t('noMembers')}</p>
        ) : (
          <ul className="settings-team-list">
            {members.map((member) => (
              <li key={member.id} className="settings-team-row">
                <div>
                  <strong>{member.user.name?.trim() || member.user.email}</strong>
                  {member.user.name && (
                    <span className="text-muted text-sm"> — {member.user.email}</span>
                  )}
                </div>
                <span className="settings-team-role">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {invites.length > 0 && (
        <>
          <div className="settings-divider" />
          <div className="settings-subsection">
            <h3>{t('pendingInvites')}</h3>
            <ul className="settings-team-list">
              {invites.map((inv) => (
                <li key={inv.id} className="settings-team-row">
                  <div>
                    <strong>{inv.email}</strong>
                    <span className="text-muted text-sm"> — {inv.role}</span>
                  </div>
                  {isAdmin && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => cancelInvite(inv.id)}>
                      {tc('cancel')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div className="settings-divider" />
          <div className="settings-subsection">
            <h3>{t('dangerZone')}</h3>
            <p className="text-muted text-sm">{t('purgeDescription')}</p>
            <Button type="button" variant="danger" size="sm" onClick={() => setPurgeOpen(true)} disabled={purging}>
              {t('purgeButton')}
            </Button>

            {purgeOpen && (
              <div className="modal-overlay" onClick={() => !purging && setPurgeOpen(false)} role="presentation">
                <div
                  className="modal card"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="purge-org-title"
                >
                  <h3 id="purge-org-title">{t('purgeTitle')}</h3>
                  <p className="modal-subtitle">{t('purgeConfirmHint')}</p>
                  <label className="modal-field" htmlFor={purgeId}>
                    {t('confirmation')}
                    <input
                      id={purgeId}
                      className="topic-input"
                      value={purgeConfirm}
                      onChange={(e) => setPurgeConfirm(e.target.value)}
                      placeholder="DELETE_ORG_CONTENT"
                      disabled={purging}
                    />
                  </label>
                  <div className="modal-actions">
                    <Button type="button" variant="ghost" onClick={() => !purging && setPurgeOpen(false)} disabled={purging}>
                      {tc('cancel')}
                    </Button>
                    <Button type="button" variant="danger" onClick={purgeOrgContent} disabled={purging}>
                      {purging ? t('purging') : t('confirmPurge')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
