import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  isEncryptedCredentialData,
} from '@autotube/config';

describe('credential-crypto', () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  it('rechaza secreto en claro sin clave (salvo ALLOW_PLAINTEXT)', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.ALLOW_PLAINTEXT_CREDENTIALS;
    const data = { refreshToken: 'abc123' };
    expect(() => encryptCredentialPayload(data)).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it('pasa datos en claro solo con ALLOW_PLAINTEXT_CREDENTIALS', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.ALLOW_PLAINTEXT_CREDENTIALS = 'true';
    const data = { refreshToken: 'abc123' };
    const stored = encryptCredentialPayload(data);
    expect(stored).toEqual(data);
    expect(decryptCredentialPayload(stored)).toEqual(data);
  });

  it('cifra y descifra con clave configurada', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-secret-key-for-unit-tests';
    delete process.env.ALLOW_PLAINTEXT_CREDENTIALS;
    const data = { refreshToken: 'secret-token', privacyStatus: 'private' };
    const stored = encryptCredentialPayload(data);
    expect(isEncryptedCredentialData(stored)).toBe(true);
    expect(decryptCredentialPayload(stored)).toEqual(data);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
    delete process.env.ALLOW_PLAINTEXT_CREDENTIALS;
  });
});
