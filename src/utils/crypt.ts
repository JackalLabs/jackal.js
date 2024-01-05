import { keyAlgo } from '@/utils/globalDefaults'
import { IAesBundle } from '@/interfaces'
import {
  safeCompressData,
  safeDecompressData,
  stringToUint16Array,
  stringToUint8Array,
  uintArrayToString
} from '@/utils/converters'
import { warnError } from '@/utils/misc'
import { decrypt, encrypt } from 'eciesjs'

/**
 * Convert CryptoKey to storable format (see importJackalKey()).
 * @param {CryptoKey} key - CryptoKey to convert.
 * @returns {Promise<Uint8Array>} - CryptoKey as Uint8Array.
 * @private
 */
export async function exportJackalKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

/**
 * Convert stored format to CryptoKey (see exportJackalKey()).
 * @param {Uint8Array} rawExport - Uint8Array to recover to CryptoKey.
 * @returns {Promise<CryptoKey>} - Recovered CryptoKey.
 * @private
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
 * @private
 */
export function genKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(keyAlgo, true, ['encrypt', 'decrypt'])
}

/**
 * Generate a new iv from scratch. Compatible with AES-256.
 * @returns {Uint8Array} - Fresh random iv.
 * @private
 */
export function genIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Encrypt or decrypt a Blob using AES-256 (AES-GCM).
 * @param {Blob} data - Source to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {"encrypt" | "decrypt"} mode - Toggle between encryption and decryption.
 * @returns {Promise<Blob>} - Processed result.
 * @private
 */
export async function aesBlobCrypt(
  data: Blob,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt'
): Promise<Blob> {
  const workingData = await data.arrayBuffer()
  const result = await aesCrypt(workingData, aes, mode)
    .catch((err) => {
      warnError('aesBlobCrypt()', err)
      throw err
    })
  return new Blob([result])
}

/**
 * Encrypt or decrypt an ArrayBuffer using AES-256 (AES-GCM).
 * @param {ArrayBuffer} data - Source to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {"encrypt" | "decrypt"} mode - Toggle between encryption and decryption.
 * @returns {Promise<ArrayBuffer>} - Processed result.
 * @private
 */
export async function aesCrypt(
  data: ArrayBuffer,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt'
): Promise<ArrayBuffer> {
  const algo = {
    name: 'AES-GCM',
    iv: aes.iv
  }
  if (data.byteLength < 1) {
    return new ArrayBuffer(0)
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle
      .encrypt(algo, aes.key, data)
      .catch((err) => {
        warnError('aesCrypt(encrypt)', err)
        throw err
      })
  } else {
    return await crypto.subtle
      .decrypt(algo, aes.key, data)
      .catch((err) => {
        warnError('aesCrypt(decrypt)', err)
        throw err
      })
  }
}

/**
 * Encrypt value using arbitrary ECIES public key.
 * @param {ArrayBuffer} toEncrypt - Value to encrypt.
 * @param {string} pubKey - Public key as hex value.
 * @returns {string} - Encrypted value as hex string.
 * @private
 */
export function eciesEncryptWithPubKey(toEncrypt: ArrayBuffer | Uint8Array, pubKey: string): string {
  if ('buffer' in toEncrypt) {
    return encrypt(pubKey, toEncrypt).toString('hex')
  } else {
    return encrypt(pubKey, new Uint8Array(toEncrypt)).toString('hex')
  }
}

/**
 * Decrypt value using ECIES private key.
 * @param {string} key - Private key as hex value.
 * @param {string | Uint8Array} toDecrypt - Value to decrypt.
 * @returns {Uint8Array} - Decrypted value.
 * @private
 */
export function eciesDecryptWithPrivateKey(key: string, toDecrypt: string | Uint8Array): Uint8Array {
  const ready = (toDecrypt instanceof Uint8Array) ? toDecrypt : stringToUint8Array(toDecrypt)
  return new Uint8Array(decrypt(key, ready))
}

/**
 * Encrypts AES iv/CryptoKey set to string using receiver's ECIES public key.
 * @param {string} pubKey - Receiver's ECIES public key.
 * @param {IAesBundle} aes - AES iv/CryptoKey set to encrypt.
 * @returns {Promise<string>} - Encrypted string with pipe "|" delimiter.
 * @private
 */
export async function aesToString(
  pubKey: string,
  aes: IAesBundle
): Promise<string> {
  const theIv = eciesEncryptWithPubKey(aes.iv, pubKey)
  const key = await exportJackalKey(aes.key)
  const theKey = eciesEncryptWithPubKey(key, pubKey)
  return `${theIv}|${theKey}`
}

/**
 * Decrypts AES iv/CryptoKey set from string using owner's ECIES private key.
 * @param {string} privateKey - Hex-encoded private key.
 * @param {string} source - String containing encrypted AES iv/CryptoKey set with pipe "|" delimiter.
 * @returns {Promise<IAesBundle>} - Decrypted AES iv/CryptoKey set.
 * @private
 */
export async function stringToAes(
  privateKey: string,
  source: string
): Promise<IAesBundle> {
  if (source.indexOf('|') < 0) {
    throw new Error(warnError('stringToAes()', 'Invalid source string'))
  }
  const [iv, key] = source.split('|')
  return {
    iv: eciesDecryptWithPrivateKey(privateKey, iv),
    key: await importJackalKey(eciesDecryptWithPrivateKey(privateKey, key))
  }
}

/**
 * Compresses source string using PLZSU and then encrypts it using AES-256 (AEG-GCM).
 * @param {string} input - Source string.
 * @param {IAesBundle} aes - AES iv/CryptoKey set.
 * @returns {Promise<string>} - Compressed and encrypted string.
 * @private
 */
export async function compressEncryptString(
  input: string,
  aes: IAesBundle
): Promise<string> {
  const compressedString = safeCompressData(input)
  return await cryptString(compressedString, aes, 'encrypt')
    .catch((err) => {
      warnError('compressEncryptString(encrypt)', err)
      throw err
    })
}

/**
 * Decrypts source string using AES-256 (AEG-GCM) and then decompresses it using PLZSU.
 * @param {string} input - Compressed and encrypted string.
 * @param {IAesBundle} aes - AES iv/CryptoKey set.
 * @returns {Promise<string>} - Decrypted and decompressed string.
 * @private
 */
export async function decryptDecompressString(
  input: string,
  aes: IAesBundle
): Promise<string> {
  const ready = await cryptString(input, aes, 'decrypt')
    .catch((err) => {
      warnError('decryptDecompressString(decrypt)', err)
      throw err
    })
  return safeDecompressData(ready)
}

/**
 * Encrypt or decrypt a string using AES-256 (AES-GCM).
 * @param {string} input - Source string to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {"encrypt" | "decrypt"} mode - Toggle between encryption and decryption.
 * @returns {Promise<string>} - Processed result.
 * @private
 */
export async function cryptString(
  input: string,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt'
): Promise<string> {
  const uint16 = stringToUint16Array(input)
  const result = await aesCrypt(uint16.buffer, aes, mode)
    .catch((err) => {
      warnError('cryptString()', err)
      throw err
    })
  return uintArrayToString(new Uint16Array(result))
}
