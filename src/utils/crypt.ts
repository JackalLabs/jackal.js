import { keyAlgo } from '@/utils/globals'
import { hashAndHex } from '@/utils/hash'
import { compressData, decompressData } from '@/utils/compression'
import { IWalletHandler } from '@/interfaces/classes'
import { IAesBundle } from '@/interfaces'
import { stringToUint16, uint16ToString } from '@/utils/misc'

const { crypto } = window ? window : globalThis

/**
 * Convert CryptoKey to storable format (see importJackalKey()).
 * @param {CryptoKey} key - CryptoKey to convert.
 * @returns {Promise<Uint8Array>} - CryptoKey as Uint8Array.
 */
export async function exportJackalKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

/**
 * Convert stored format to CryptoKey (see exportJackalKey()).
 * @param {Uint8Array} rawExport - Uint8Array to recover to CryptoKey.
 * @returns {Promise<CryptoKey>} - Recovered CryptoKey.
 */
export function importJackalKey(rawExport: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawExport, 'AES-GCM', true, [
    'encrypt',
    'decrypt'
  ])
}

/**
 * Generate a new CryptoKey from scratch. Compatible with AES-256 and exportJackalKey(). Supports encrypt and decrypt.
 * @returns {Promise<CryptoKey>} - Fresh random CryptoKey.
 */
export function genKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
}

/**
 * Generate a new iv from scratch. Compatible with AES-256.
 * @returns {Uint8Array} - Fresh random iv.
 */
export function genIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Encrypt or decrypt a Blob using AES-256 (AES-GCM).
 * @param {Blob} data - Source to encrypt or decrypt.
 * @param {CryptoKey} key - Key to use. Decryption key must match encryption key that was used.
 * @param {Uint8Array} iv - Iv to use. Decryption iv must match encryption iv that was used.
 * @param {"encrypt" | "decrypt"} mode - Toggle between encryption and decryption.
 * @returns {Promise<Blob>} - Processed result.
 */
export async function aesCrypt(
  data: Blob,
  key: CryptoKey,
  iv: Uint8Array,
  mode: 'encrypt' | 'decrypt'
): Promise<Blob> {
  const algo = {
    name: 'AES-GCM',
    iv
  }
  const workingData = await data.arrayBuffer()
  if (workingData.byteLength < 1) {
    return new Blob([])
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle
      .encrypt(algo, key, workingData)
      .then((res) => {
        return new Blob([res])
      })
      .catch((err) => {
        console.error(`aesCrypt(encrypt) - ${err}`)
        throw err
      })
  } else {
    return await crypto.subtle
      .decrypt(algo, key, workingData)
      .then((res) => {
        return new Blob([res])
      })
      .catch((err) => {
        console.error(`aesCrypt(decrypt) - ${err}`)
        throw err
      })
  }
}

/**
 * Encrypts AES iv/CryptoKey set to string using receiver's ECIES public key.
 * @param {IWalletHandler} wallet - Wallet instance for accessing functions.
 * @param {string} pubKey - Receiver's ECIES public key.
 * @param {IAesBundle} aes - AES iv/CryptoKey set to encrypt.
 * @returns {Promise<string>} - Encrypted string with pipe "|" delimiter.
 */
export async function aesToString(
  wallet: IWalletHandler,
  pubKey: string,
  aes: IAesBundle
): Promise<string> {
  const theIv = wallet.asymmetricEncrypt(aes.iv, pubKey)
  const key = await exportJackalKey(aes.key)
  const theKey = wallet.asymmetricEncrypt(key, pubKey)
  return `${theIv}|${theKey}`
}

/**
 * Decrypts AES iv/CryptoKey set from string using owner's ECIES private key.
 * @param {IWalletHandler} wallet - Wallet instance for accessing functions and owner's private key.
 * @param {string} source - String containing encrypted AES iv/CryptoKey set with pipe "|" delimiter.
 * @returns {Promise<IAesBundle>} - Decrypted AES iv/CryptoKey set.
 */
export async function stringToAes(
  wallet: IWalletHandler,
  source: string
): Promise<IAesBundle> {
  if (source.indexOf('|') < 0) {
    throw new Error('stringToAes() : Invalid source string')
  }
  const parts = source.split('|')
  return {
    iv: new Uint8Array(wallet.asymmetricDecrypt(parts[0])),
    key: await importJackalKey(
      new Uint8Array(wallet.asymmetricDecrypt(parts[1]))
    )
  }
}

/**
 * Converts raw File to Public-mode File.
 * @param {File} workingFile - Source File.
 * @returns {Promise<File>} - Public-mode File.
 */
export async function convertToPublicFile(workingFile: File): Promise<File> {
  const chunkSize = 32 * Math.pow(1024, 2) /** in bytes */
  const details = {
      name: workingFile.name,
      lastModified: workingFile.lastModified,
      type: workingFile.type,
      size: workingFile.size
    }
  const detailsBlob = new Blob([JSON.stringify(details)])
  const publicArray: Blob[] = [
    new Blob([(detailsBlob.size + 16).toString().padStart(8, '0')]),
    detailsBlob
  ]
  for (let i = 0; i < workingFile.size; i += chunkSize) {
    const blobChunk = workingFile.slice(i, i + chunkSize)
    publicArray.push(
      new Blob([(blobChunk.size + 16).toString().padStart(8, '0')]),
      blobChunk
    )
  }
  const finalName = `${await hashAndHex(
    details.name + Date.now().toString()
  )}.jkl`
  return new File(publicArray, finalName, { type: 'text/plain' })
}

/**
 * Converts raw Public-mode Blob to File.
 * @param {Blob} source - Source raw Blob.
 * @returns {Promise<File>} - Decrypted File.
 */
export async function convertFromPublicFile(source: Blob): Promise<File> {
  let detailsBlob = new Blob([])
  const blobParts: Blob[] = []
  for (let i = 0; i < source.length; ) {
    const offset = i + 8
    const segSize = Number(source.slice(i, offset).toString())
    const last = offset + segSize
    const segment = source.slice(offset, last)
    if (i === 0) {
      detailsBlob = segment
    } else {
      blobParts.push(segment)
    }
    i = last
  }
  const details = JSON.parse(detailsBlob.toString())
  return new File(blobParts, details.name, details)
}

/**
 * Converts raw File to encrypted File.
 * @param {File} workingFile - Source File.
 * @param {CryptoKey} key - AES-256 CryptoKey.
 * @param {Uint8Array} iv - AES-256 iv.
 * @returns {Promise<File>} - Encrypted File.
 */
export async function convertToEncryptedFile(
  workingFile: File,
  key: CryptoKey,
  iv: Uint8Array
): Promise<File> {
  const chunkSize = 32 * Math.pow(1024, 2) /** in bytes */
  const details = {
    name: workingFile.name,
    lastModified: workingFile.lastModified,
    type: workingFile.type,
    size: workingFile.size
  }
  const detailsBlob = new Blob([JSON.stringify(details)])
  const encryptedArray: Blob[] = [
    new Blob([(detailsBlob.size + 16).toString().padStart(8, '0')]),
    await aesCrypt(detailsBlob, key, iv, 'encrypt')
  ]
  for (let i = 0; i < workingFile.size; i += chunkSize) {
    const blobChunk = workingFile.slice(i, i + chunkSize)
    encryptedArray.push(
      new Blob([(blobChunk.size + 16).toString().padStart(8, '0')]),
      await aesCrypt(blobChunk, key, iv, 'encrypt')
    )
  }
  const finalName = `${await hashAndHex(
    details.name + Date.now().toString()
  )}.jkl`
  return new File(encryptedArray, finalName, { type: 'text/plain' })
}

/**
 * Converts raw Blob to decrypted File.
 * @param {Blob} source - Source raw Blob.
 * @param {CryptoKey} key - AES-256 CryptoKey.
 * @param {Uint8Array} iv - AES-256 iv.
 * @returns {Promise<File>} - Decrypted File.
 */
export async function convertFromEncryptedFile(
  source: Blob,
  key: CryptoKey,
  iv: Uint8Array
): Promise<File> {
  let detailsBlob = new Blob([])
  const blobParts: Blob[] = []
  for (let i = 0; i < source.size; ) {
    const offset = i + 8
    const segSize = Number(await source.slice(i, offset).text())
    const last = offset + segSize
    const segment = source.slice(offset, last)

    const rawBlob = await aesCrypt(segment, key, iv, 'decrypt')
    if (i === 0) {
      detailsBlob = rawBlob
    } else {
      blobParts.push(rawBlob)
    }
    i = last
  }
  const details = JSON.parse(await detailsBlob.text())
  return new File(blobParts, details.name, details)
}

/**
 * Compresses source string using PLZSU and then encrypts it using AES-256 (AEG-GCM).
 * @param {string} input - Source string.
 * @param {CryptoKey} key - AES-256 CryptoKey.
 * @param {Uint8Array} iv - AES-256 iv.
 * @returns {Promise<string>} - Compressed and encrypted string.
 */
export async function compressEncryptString(
  input: string,
  key: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const compString = compressData(input)
  const data = await cryptString(compString, key, iv, 'encrypt')
  console.log(data)
  return data
}

/**
 * Decrypts source string using AES-256 (AEG-GCM) and then decompresses it using PLZSU.
 * @param {string} input - Compressed and encrypted string.
 * @param {CryptoKey} key - AES-256 CryptoKey.
 * @param {Uint8Array} iv - AES-256 iv.
 * @returns {Promise<string>} - Decrypted and decompressed string.
 */
export async function decryptDecompressString(
  input: string,
  key: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  console.log(input)
  // const decryptBlob = await cryptString(input, key, iv, 'decrypt')
  return decompressData(await cryptString(input, key, iv, 'decrypt'))
}

/**
 * Encrypt or decrypt a string using AES-256 (AES-GCM).
 * @param {string} input - Source string to encrypt or decrypt.
 * @param {CryptoKey} key - CryptoKey to use. Decryption CryptoKey must match encryption CryptoKey that was used.
 * @param {Uint8Array} iv - Iv to use. Decryption iv must match encryption iv that was used.
 * @param {"encrypt" | "decrypt"} mode - Toggle between encryption and decryption.
 * @returns {Promise<string>} - Processed result.
 */
export async function cryptString(
  input: string,
  key: CryptoKey,
  iv: Uint8Array,
  mode: 'encrypt' | 'decrypt'
): Promise<string> {
  const uint16 = stringToUint16(input)
  const result = await aesCrypt(new Blob([uint16]), key, iv, mode)
  return uint16ToString(new Uint16Array(await result.arrayBuffer()))
}
