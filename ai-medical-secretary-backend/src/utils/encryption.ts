import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY || '';

if (!KEY_HEX || Buffer.from(KEY_HEX, 'hex').length !== 32) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Encryption] ENCRYPTION_KEY is missing or invalid (must be 64 hex chars / 32 bytes). Encryption disabled – fields stored in plain text.');
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!KEY_HEX) return plaintext; // graceful degradation if key not configured

  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: <iv(12B)>:<authTag(16B)>:<ciphertext>  → base64
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt a ciphertext produced by `encrypt`.
 * Returns the original plaintext string.
 */
export function decrypt(ciphertext: string): string {
  if (!KEY_HEX) return ciphertext; // graceful degradation

  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // not encrypted – return as-is

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Deterministic SHA-256 hash for indexed lookups (e.g. phone, email).
 * DO NOT use for password storage.
 */
export function hashForIndex(value: string): string {
  const HASH_SALT = process.env.HASH_SALT || 'default-salt-change-me';
  return crypto.createHash('sha256').update(HASH_SALT + value).digest('hex');
}
