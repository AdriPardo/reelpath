import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const ENVELOPE_VERSION = 1;

export interface EncryptedCredentialEnvelope {
  __encrypted: true;
  v: number;
  payload: string;
}

function getEncryptionKey(): Buffer | null {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!key) return null;
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

export function isCredentialEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

export function isEncryptedCredentialData(
  data: unknown,
): data is EncryptedCredentialEnvelope {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as EncryptedCredentialEnvelope).__encrypted === true &&
    typeof (data as EncryptedCredentialEnvelope).payload === 'string'
  );
}

export function encryptCredentialPayload(data: Record<string, unknown>): object {
  const key = getEncryptionKey();
  if (!key) return data;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, encrypted]).toString('base64');
  return { __encrypted: true, v: ENVELOPE_VERSION, payload } satisfies EncryptedCredentialEnvelope;
}

export function decryptCredentialPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  if (!isEncryptedCredentialData(data)) {
    return data as Record<string, unknown>;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY no configurada pero hay credenciales cifradas en BD',
    );
  }

  const raw = Buffer.from(data.payload, 'base64');
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + 16);
  const ciphertext = raw.subarray(IV_BYTES + 16);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return JSON.parse(decrypted) as Record<string, unknown>;
}
