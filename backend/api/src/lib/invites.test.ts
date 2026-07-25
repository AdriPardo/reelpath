import { describe, expect, it } from 'vitest';

/** Lógica pura equivalente a la comprobación de invitación expirada en org routes. */
export function isInviteExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

describe('normalizeInviteEmail', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizeInviteEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('isInviteExpired', () => {
  it('marca expirada una invitación pasada', () => {
    const past = new Date(Date.now() - 60_000);
    expect(isInviteExpired(past)).toBe(true);
  });

  it('acepta invitación vigente', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isInviteExpired(future)).toBe(false);
  });
});
