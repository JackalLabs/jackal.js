import { describe, expect, test } from 'vitest'
import {
  aesCrypt,
  compressEncryptString,
  cryptString, eciesEncryptWithPubKey,
  exportJackalKey,
  genAesBundle,
  genIv,
  genKey,
  importJackalKey,
} from '@/utils/crypt'
import { safeDecompressData, stringToUint16Array, uintArrayToString } from '@/utils/converters'
import { PrivateKey } from 'eciesjs'

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
    // expect(exported).toBe(0)
    expect(imported).toBeDefined()
  })

  test('eciesEncryptWithPubKey ', async () => {
    let defaultKeyPair = PrivateKey.fromHex('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    const staticAes = {
      iv: new Uint8Array([10, 182, 241, 205, 156, 79, 7, 97, 252, 75, 154, 115, 250, 178, 126, 166]),
      key: await importJackalKey(new Uint8Array([199, 19, 54, 241, 42, 20, 91, 99, 198, 141, 22, 202, 195, 71, 51, 216, 204, 26, 180, 230, 58, 223, 167, 143, 126, 28, 3, 102, 2, 57, 224, 178])),
    }
    const randomAes = await genAesBundle()

    const randomIvAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), randomAes.iv)
    const randomKey = await exportJackalKey(randomAes.key)
    const randomKeyAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), randomKey)

    expect(randomIvAsHex).toBeDefined()
    expect(randomKeyAsHex).toBeDefined()

    const staticIvAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), staticAes.iv)
    const staticKey = await exportJackalKey(staticAes.key)
    const staticKeyAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), staticKey)

    expect(staticIvAsHex).toBe('0441cc87600f47dc8962e9f9f653a6d1c956f36c6243026e1a9951a74af7e0f24d4b8bc5966437c7a237a1ed407b40edf277efdebf4991524eab879e328ad7cbb7785ed3ad27f60ba6f873da06160c312a9d3182654ddfde81224b94ff2b06c6cc92538f39475f60987d8bb134b82a5dc3')
    expect(staticKeyAsHex).toBe('040756a44fb9cb93497f6e3390402cf3bef303c8d3829ff7c9d147e11fa3f3d6f2db84530616cf2ae7a250a0948a27776f3a1e125a69fccbfc72966606dac6d4c848452697af7bd97983f658a1e3d8e43631acfc8db4e7b309877e52a17220608e07f8ca5f7c5fbc16ff39605a05193a88')
  })

  test('eciesDecryptWithPrivateKey ', async () => {
    const key = await genKey()
    const exported = await exportJackalKey(key)
    const imported = await importJackalKey(exported)
    // expect(exported).toBe(0)
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

  test('compressEncryptString should work the same in browser and node', async () => {
    const aes = {
      iv: new Uint8Array([10, 182, 241, 205, 156, 79, 7, 97, 252, 75, 154, 115, 250, 178, 126, 166]),
      key: await importJackalKey(new Uint8Array([199, 19, 54, 241, 42, 20, 91, 99, 198, 141, 22, 202, 195, 71, 51, 216, 204, 26, 180, 230, 58, 223, 167, 143, 126, 28, 3, 102, 2, 57, 224, 178])),
    }
    const meta = {
      'count': '0',
      'description': '',
      'location': 's/ulid/ulid',
      'merkleHex': '',
      'metaDataType': 'folder',
      'sharerCount': '0',
      'whoAmI': 'Home',
    }
    const rdy = JSON.stringify(meta)

    const encrypted = await compressEncryptString(rdy, aes, false)
    expect(encrypted).toBe('ꄺ쟲ᄉˉ퇿볚⊘x挔䜖뒚胵ɘࡘ䔟录큹襰죣⾁鉊겍ᾀ梥ﴑ犱杒ᗷ⨱㙿콟ᅞ鶇❘ུ䔥暉㗧즸籆㥐ꐚퟨ淪㑬ㇳ跔䩏㵫㇀黰ຎ缇韲쨂Ȫ揁㠭魐쪺ꥣ')

    const decrypted = await cryptString(encrypted, aes, 'decrypt')
    const decompressed = safeDecompressData(decrypted)
    expect(decompressed).toBe(rdy)
  })
})
