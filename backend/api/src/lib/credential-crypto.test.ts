import { afterEach, describe, expect, it } from 'vitest';
import {
  decryptCredentialPayload,
  encryptCredentialPayload,
  isEncryptedCredentialData,
} from '@autotube/config';

describe('credential-crypto', () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  it('pasa datos en claro si no hay clave', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    const data = { refreshToken: 'abc123' };
    const stored = encryptCredentialPayload(data);
    expect(stored).toEqual(data);
    expect(decryptCredentialPayload(stored)).toEqual(data);
  });

  it('cifra y descifra con clave configurada', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-secret-key-for-unit-tests';
    const data = { refreshToken: 'secret-token', privacyStatus: 'private' };
    const stored = encryptCredentialPayload(data);
    expect(isEncryptedCredentialData(stored)).toBe(true);
    expect(decryptCredentialPayload(stored)).toEqual(data);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
  });
});
