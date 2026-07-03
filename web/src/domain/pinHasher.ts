// PINHasher 移植：SHA-256(salt + utf8(pin))，输出 32 字节。
// Web Crypto 的 digest 是异步的，故接口为 async（iOS 版为同步 CryptoKit）。

export async function hashPin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const pinBytes = new TextEncoder().encode(pin)
  const data = new Uint8Array(salt.length + pinBytes.length)
  data.set(salt, 0)
  data.set(pinBytes, salt.length)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(digest)
}

export function makeSalt(length: number = 16): Uint8Array {
  const salt = new Uint8Array(length)
  crypto.getRandomValues(salt)
  return salt
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 存储格式（对位 iOS Keychain 48 字节 blob）：base64(salt(16) + sha256(salt+pin)(32))。 */
export async function encodePinBlob(pin: string): Promise<string> {
  const salt = makeSalt()
  const hash = await hashPin(pin, salt)
  const blob = new Uint8Array(salt.length + hash.length)
  blob.set(salt, 0)
  blob.set(hash, salt.length)
  return bytesToBase64(blob)
}

export async function verifyPinBlob(pin: string, blobB64: string): Promise<boolean> {
  let blob: Uint8Array
  try {
    blob = base64ToBytes(blobB64)
  } catch {
    return false // 非法 blob（损坏/被篡改）按验证失败处理，不抛异常
  }
  if (blob.length !== 48) return false
  const salt = blob.slice(0, 16)
  const stored = blob.slice(16)
  const hash = await hashPin(pin, salt)
  if (hash.length !== stored.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ stored[i]
  return diff === 0
}
