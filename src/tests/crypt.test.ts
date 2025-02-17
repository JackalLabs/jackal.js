import { describe, expect, test } from 'vitest'
import {
  exportJackalKey,
  importJackalKey,
  genKey,
  genIv,
  genAesBundle,
  aesCrypt, cryptString,
} from '@/utils/crypt'
import { stringToUint16Array, uintArrayToString } from '@/utils/converters'

const testString = 'this is my test string'

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
    const input = new TextEncoder().encode(testString).buffer

    const encrypted = await aesCrypt(input, aes, 'encrypt')
    expect(encrypted.byteLength).toBeGreaterThan(0)

    const decrypted = await aesCrypt(encrypted, aes, 'decrypt')
    expect(new TextDecoder().decode(decrypted)).toBe(testString)
  })
  test('aesCrypt should correctly encrypt and decrypt data 2', async () => {
    const aes = await genAesBundle()
    const input = stringToUint16Array(testString)

    const encrypted = await aesCrypt(input, aes, 'encrypt')
    expect(encrypted.byteLength).toBe(60)

    const middle = uintArrayToString(new Uint16Array(encrypted))
    const ready = stringToUint16Array(middle)

    expect(ready.buffer.byteLength).toBe(60)
    expect(ready.buffer).toStrictEqual(encrypted)

    const decrypted = await aesCrypt(ready.buffer, aes, 'decrypt')
    expect(uintArrayToString(new Uint16Array(decrypted))).toBe(testString)
  })

  test('cryptString should correctly encrypt and decrypt data', async () => {
    const aes = await genAesBundle()

    const encrypted = await cryptString(testString, aes, 'encrypt')
    expect(encrypted.length).toBeGreaterThan(0)

    const decrypted = await cryptString(encrypted, aes, 'decrypt')
    expect(decrypted).toBe(testString)
  })
})
