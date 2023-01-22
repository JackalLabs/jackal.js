import { keyAlgo } from '@/utils/globals'
import { hashAndHex } from '@/utils/hash'
import { addPadding } from '@/utils/misc'

export async function exportJackalKey (key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}
export function importJackalKey (rawExport: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawExport, 'AES-GCM', true, ['encrypt', 'decrypt'])
}
export function genKey (): Promise<CryptoKey> {
  return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
}
export function genIv (): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export async function aesCrypt (data: ArrayBuffer, key: CryptoKey, iv: Uint8Array, mode: 'encrypt' | 'decrypt'): Promise<ArrayBuffer> {
  const algo = {
    name: 'AES-GCM',
    iv
  }
  if (data.byteLength < 1) {
    return new ArrayBuffer(0)
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle.encrypt(algo, key, data)
      .then(res => {
        return res
      })
      .catch(err => {
        throw new Error(err)
      })
  } else {
    return await crypto.subtle.decrypt(algo, key, data)
      .then(res => {
        return res
      })
      .catch(err => {
        throw new Error(err)
      })
  }
}
export function encryptPrep (source: ArrayBuffer): ArrayBuffer[] {
  const paddedSource = addPadding(source)
  const chunkSize = 33554432 /** in bytes */
  const len = paddedSource.byteLength
  const count = Math.ceil(len / chunkSize)

  if (count === 1) {
    return [paddedSource]
  } else {
    const ret = []
    for (let i = 0; i < count; i++) {
      const startIndex = i * chunkSize
      const endIndex = (i + 1) * chunkSize
      ret.push(paddedSource.slice(startIndex, endIndex))
    }
    return ret
  }
}
export function decryptPrep (source: ArrayBuffer): ArrayBuffer[] {
  const parts: ArrayBuffer[] = []
  for (let i = 0; i + 1 < source.byteLength;) {
    const offset = i + 8
    const segSize = Number((new TextDecoder()).decode(source.slice(i, offset)))
    const last = offset + segSize
    const segment = source.slice(offset, last)
    parts.push(segment)
    i = last
  }
  return parts
}

export async function assembleEncryptedFile (parts: ArrayBuffer[], name: string): Promise<File> {
  const staged: ArrayBuffer[] = []
  for (let i = 0; i < parts.length; i++) {
    staged.push(
      (new TextEncoder()).encode(parts[i].byteLength.toString().padStart(8, '0')).buffer,
      parts[i]
    )
  }
  const finalName = `${await hashAndHex(name + Date.now().toString())}.jkl`
  const tstFile =  new File(staged, finalName, { type: 'text/plain' })
  return tstFile
}
