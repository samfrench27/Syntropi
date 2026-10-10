const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

/** A new API key. Only its hash is stored; the caller shows the plaintext once. */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const key = `sk_${toHex(crypto.getRandomValues(new Uint8Array(24)))}`;
  return { key, hash: await sha256Hex(key), prefix: key.slice(0, 11) };
}

export const randomId = (bytes = 12) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
