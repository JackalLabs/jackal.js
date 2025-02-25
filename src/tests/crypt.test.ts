import { describe, expect, test } from 'vitest'
import {
  aesCrypt,
  compressEncryptString,
  cryptString,
  eciesDecryptWithPrivateKey,
  eciesEncryptWithPubKey,
  exportJackalKey,
  genAesBundle,
  genIv,
  genKey,
  importJackalKey,
  stringToAes,
} from '@/utils/crypt'
import {
  safeCompressData,
  safeDecompressData,
  safeStringifyFileTree,
  stringToUint16Array,
  uintArrayToString,
} from '@/utils/converters'
import { PrivateKey } from 'eciesjs'
import { IFileMetaData } from '@/interfaces'

const testString = 'this is my test string'
let defaultKeyPair = PrivateKey.fromHex('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
const keyAsUint = new Uint8Array([199, 19, 54, 241, 42, 20, 91, 99, 198, 141, 22, 202, 195, 71, 51, 216, 204, 26, 180, 230, 58, 223, 167, 143, 126, 28, 3, 102, 2, 57, 224, 178])
const staticAes = {
  iv: new Uint8Array([10, 182, 241, 205, 156, 79, 7, 97, 252, 75, 154, 115, 250, 178, 126, 166]),
  key: await importJackalKey(keyAsUint),
  keyAsUint,
}

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
    const randomAes = await genAesBundle()

    const randomIvAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), randomAes.iv)
    const randomKey = await exportJackalKey(randomAes.key)
    const randomKeyAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), randomKey)

    expect(randomIvAsHex).toBeDefined()
    expect(randomKeyAsHex).toBeDefined()

    // const staticIvAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), staticAes.iv)
    // const staticKey = await exportJackalKey(staticAes.key)
    // const staticKeyAsHex = eciesEncryptWithPubKey(defaultKeyPair.publicKey.toHex(), staticKey)
    //
    // expect(staticIvAsHex).toBe('0441cc87600f47dc8962e9f9f653a6d1c956f36c6243026e1a9951a74af7e0f24d4b8bc5966437c7a237a1ed407b40edf277efdebf4991524eab879e328ad7cbb7785ed3ad27f60ba6f873da06160c312a9d3182654ddfde81224b94ff2b06c6cc92538f39475f60987d8bb134b82a5dc3')
    // expect(staticKeyAsHex).toBe('0417e22c547cc51d4b87b8b0cd8e6e98a263a58dc1c97f3e0a61283375a4747a8a9a5e6f00fa7aa08cdd4c8aa40c4391f012f3d03be2e88b8c755c79f581e0550d3737ec10e75f53d0c0d2c9c159a7110935efe203b7c85e5cb4b4a6b7794be274b62e8b09cd4a8b88ea67846eadc5a2c4883874b814b263aa586dbd1ff24439f7')
  })

  test('eciesDecryptWithPrivateKey ', async () => {
    const staticIvFromHex = eciesDecryptWithPrivateKey(defaultKeyPair, '0441cc87600f47dc8962e9f9f653a6d1c956f36c6243026e1a9951a74af7e0f24d4b8bc5966437c7a237a1ed407b40edf277efdebf4991524eab879e328ad7cbb7785ed3ad27f60ba6f873da06160c312a9d3182654ddfde81224b94ff2b06c6cc92538f39475f60987d8bb134b82a5dc3')
    expect(staticIvFromHex).toStrictEqual(staticAes.iv)
    const staticKeyFromHex = eciesDecryptWithPrivateKey(defaultKeyPair, '0417e22c547cc51d4b87b8b0cd8e6e98a263a58dc1c97f3e0a61283375a4747a8a9a5e6f00fa7aa08cdd4c8aa40c4391f012f3d03be2e88b8c755c79f581e0550d3737ec10e75f53d0c0d2c9c159a7110935efe203b7c85e5cb4b4a6b7794be274b62e8b09cd4a8b88ea67846eadc5a2c4883874b814b263aa586dbd1ff24439f7')
    expect(staticKeyFromHex).toStrictEqual(staticAes.keyAsUint)
    const key = await importJackalKey(staticKeyFromHex)
    expect(key).toStrictEqual(staticAes.key)
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
      iv: staticAes.iv,
      key: staticAes.key,
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

  test('compressEncryptString should work the same in browser and node 2', async () => {
    const aes = await stringToAes(defaultKeyPair, '0441cc87600f47dc8962e9f9f653a6d1c956f36c6243026e1a9951a74af7e0f24d4b8bc5966437c7a237a1ed407b40edf277efdebf4991524eab879e328ad7cbb7785ed3ad27f60ba6f873da06160c312a9d3182654ddfde81224b94ff2b06c6cc92538f39475f60987d8bb134b82a5dc3|0417e22c547cc51d4b87b8b0cd8e6e98a263a58dc1c97f3e0a61283375a4747a8a9a5e6f00fa7aa08cdd4c8aa40c4391f012f3d03be2e88b8c755c79f581e0550d3737ec10e75f53d0c0d2c9c159a7110935efe203b7c85e5cb4b4a6b7794be274b62e8b09cd4a8b88ea67846eadc5a2c4883874b814b263aa586dbd1ff24439f7')
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

  test('compressEncryptString should work with files', async () => {
    const aes = await stringToAes(defaultKeyPair, '0441cc87600f47dc8962e9f9f653a6d1c956f36c6243026e1a9951a74af7e0f24d4b8bc5966437c7a237a1ed407b40edf277efdebf4991524eab879e328ad7cbb7785ed3ad27f60ba6f873da06160c312a9d3182654ddfde81224b94ff2b06c6cc92538f39475f60987d8bb134b82a5dc3|0417e22c547cc51d4b87b8b0cd8e6e98a263a58dc1c97f3e0a61283375a4747a8a9a5e6f00fa7aa08cdd4c8aa40c4391f012f3d03be2e88b8c755c79f581e0550d3737ec10e75f53d0c0d2c9c159a7110935efe203b7c85e5cb4b4a6b7794be274b62e8b09cd4a8b88ea67846eadc5a2c4883874b814b263aa586dbd1ff24439f7')
    const uint = new Uint8Array([15, 146, 87, 230, 104, 247, 104, 225, 94, 90, 90, 79, 206, 193, 193, 197, 232, 162, 59, 0, 164, 184, 214, 178, 46, 248, 21, 134, 199, 84, 18, 253, 167, 25, 160, 45, 57, 105, 105, 156, 7, 7, 253, 238, 74, 211, 71, 2, 79, 145, 167, 45, 96, 111, 222, 133, 169, 139, 51, 106, 106, 200, 61, 56])

    const meta = {
      'description': '',
      'fileMeta': { 'lastModified': 1740504348059, 'name': 'vite.config.ts', 'size': 324, 'type': 'video/mp2t' },
      'location': 's/ulid/01JMZ28R1E8QWB2GASSE7GKRCY',
      'merkleHex': '0f9257e668f768e15e5a5a4fcec1c1c5e8a23b00a4b8d6b22ef81586c75412fda719a02d3969699c0707fdee4ad347024f91a72d606fde85a98b336a6ac83d38',
      'merkleMem': uintArrayToString(uint),
      // 'merkleRoot': uint,
      'metaDataType': 'file',
      'sharerCount': '0',
      'thumbnail': '',
      'ulid': '01JMZ29DH554FK9CP61GTA0406',
    }

    const rdy = safeStringifyFileTree(meta as IFileMetaData)

    const encrypted = await compressEncryptString(rdy, aes, false)
    expect(encrypted).toBe('ꄺ쟲ᄉˉ퇿맚䊓䞳䲖⪊䁴繰湊遭崐忖窭셃㕝ᇚ㙥냹⟌ぷ䝿宠돼幓䱼ᥒ䲖㿀續暚헼槈噘꿈饵痾镾ꖆ燣㮽ٛ獦깓⧭ࡅᣊᦎ韷ꃆ渦癚�⶛吓贉㝍ị୅㞟癸�韩鵟⏲⦀঄虓�徹⎠쵻驱溝뙆겛픀副ﵟ隣⮚โ㖓筄挫埀䃟ច狘麆㝨䎗덂ꃧ⪂꓏ꤓ搣䉄䈒酼鷖좠デ洐৒�鱫䂉㲶뿭୎൫詷⁬೐䫚壋喐�ᲄ﹟樰Է跚䃒﫡嶟磺噒ᒷ㘁굮冔Ā鎔젠�ẞ捛쉻恤厅䂅䀒턑Კ闌뭴뎉爌䢌�鯅踹퍠腚쟧쐣밪ꜽ⢡챂㪾堾ꇍ艓䢭ꕶ䁈੔篚䶰ᾰ猛၅峪Ꞩ䐶嫗诼ﴥ噍ྐྵ崰틠梜⩂龲搁Ḕ揆秄舄첳ᄃ㥴⑦狎耐诿쨏ಀ仂က禑缵빞蜡渋�ㆯ翘瑽⥥ꋐେ숥綖⍾㳺ﲓ櫸潁徂ꆽ抣')

    const decrypted = await cryptString(encrypted, aes, 'decrypt')
    const decompressed = safeDecompressData(decrypted)
    expect(decompressed).toBe(rdy)
  })
})
