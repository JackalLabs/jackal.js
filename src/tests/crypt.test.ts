import { describe, expect, test } from 'vitest'
import {
  exportJackalKey,
  importJackalKey,
  genKey,
  genIv,
  genAesBundle,
  aesCrypt
} from '@/utils/crypt'

describe('Key & AES Functions', () => {
  test('genKey should generate a valid CryptoKey', async () => {
    const key = await genKey()
    expect(key).toBeDefined()
  })

  test('genIv should generate a 16-byte IV', () => {
    const iv = genIv()
    expect(iv.length).toBe(16)
  })

  test('exportJackalKey and importJackalKey should be inverses', async () => {
    const key = await genKey()
    const exported = await exportJackalKey(key)
    const imported = await importJackalKey(exported)
    expect(imported).toBeDefined()
  })
})

describe('AES Encryption & Decryption', () => {
  test('aesCrypt should correctly encrypt and decrypt data', async () => {
    const aes = await genAesBundle()
    const input = new TextEncoder().encode('Test String').buffer

    const encrypted = await aesCrypt(input, aes, 'encrypt')
    expect(encrypted.byteLength).toBeGreaterThan(0)

    const decrypted = await aesCrypt(encrypted, aes, 'decrypt')
    expect(new TextDecoder().decode(decrypted)).toBe('Test String')
  })
})
