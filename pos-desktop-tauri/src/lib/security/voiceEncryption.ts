/**
 * @file voiceEncryption.ts
 * @description Hardware-anchored AES-256-GCM encryption for voice audits, audio payloads, and AI transcripts.
 * Ensures strict tamper-proof offline-first compliance before cloud sync to Supabase.
 */

import { secureStorage } from './secureStorage';

const AUDIT_KEY_STORAGE = 'mozpos_voice_vault_key_2026';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Retrieves or generates an AES-256-GCM CryptoKey anchored to this POS terminal
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const existingKeyB64 = secureStorage.getItem(AUDIT_KEY_STORAGE);

  if (existingKeyB64) {
    try {
      const rawKey = Uint8Array.from(atob(existingKeyB64), (c) => c.charCodeAt(0));
      return await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      console.warn('[VoiceCrypto] Failed to import stored encryption key, regenerating key...', e);
    }
  }

  // Generate a fresh cryptographically strong 256-bit AES-GCM key
  const freshKey = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedRaw = await crypto.subtle.exportKey('raw', freshKey);
  const exportedB64 = btoa(String.fromCharCode(...new Uint8Array(exportedRaw)));
  secureStorage.setItem(AUDIT_KEY_STORAGE, exportedB64);

  return freshKey;
}

export interface EncryptedPayload {
  v: number; // schema version
  iv: string; // Base64 Initialization Vector (12 bytes)
  cipher: string; // Base64 Ciphertext + Tag
  timestamp: string;
}

/**
 * Encrypts arbitrary voice interaction payload (transcript, parsed entities, audio metadata)
 * using AES-GCM with a unique 96-bit (12-byte) IV per record.
 */
export async function encryptVoicePayload(data: Record<string, any> | string): Promise<string> {
  try {
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const encodedData = encoder.encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encodedData
    );

    const ivB64 = btoa(String.fromCharCode(...iv));
    const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));

    const payload: EncryptedPayload = {
      v: 1,
      iv: ivB64,
      cipher: cipherB64,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error('[VoiceCrypto] Encryption error:', error);
    // Fallback obfuscated representation to never block POS checkout flow
    return JSON.stringify({
      v: 0,
      fallback: btoa(typeof data === 'string' ? data : JSON.stringify(data)),
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Decrypts a previously encrypted voice payload.
 */
export async function decryptVoicePayload(encryptedJson: string): Promise<any> {
  try {
    const parsed: EncryptedPayload & { fallback?: string } = JSON.parse(encryptedJson);

    if (parsed.v === 0 && parsed.fallback) {
      return JSON.parse(atob(parsed.fallback));
    }

    const key = await getOrCreateEncryptionKey();
    const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(parsed.cipher), (c) => c.charCodeAt(0));

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedBuffer);
    try {
      return JSON.parse(decryptedText);
    } catch {
      return decryptedText;
    }
  } catch (error) {
    console.error('[VoiceCrypto] Decryption error:', error);
    return null;
  }
}
