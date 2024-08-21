import type { PrivateKey } from 'eciesjs'
import { decrypt, encrypt } from 'eciesjs'
import { keyAlgo } from '@/utils/globalDefaults'
import {
  prepDecompressionForAmino,
  safeCompressData,
  safeDecompressData,
  sanitizeCompressionForAmino,
  stringToUint16Array,
  uintArrayToString,
} from '@/utils/converters'
import { warnError } from '@/utils/misc'
import { hexToBuffer } from '@/utils/hash'
import type { IAesBundle } from '@/interfaces'

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
    'decrypt',
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
 * Generate AES bundle of IV and Key.
 * @returns {Promise<IAesBundle>} - AES bundle.
 * @private
 */
export async function genAesBundle(): Promise<IAesBundle> {
  return {
    iv: genIv(),
    key: await genKey(),
  }
}

/**
 * Encrypt or decrypt a Blob using AES-256 (AES-GCM).
 * @param {Blob} data - Source to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {'encrypt' | 'decrypt'} mode - Toggle between encryption and decryption.
 * @returns {Promise<Blob>} - Processed result.
 * @private
 */
export async function aesBlobCrypt(
  data: Blob,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt',
): Promise<Blob> {
  const workingData = await data.arrayBuffer()
  const result = await aesCrypt(workingData, aes, mode).catch((err) => {
    warnError('aesBlobCrypt()', err)
    throw err
  })
  return new Blob([result])
}

/**
 * Encrypt or decrypt an ArrayBuffer using AES-256 (AES-GCM).
 * @param {ArrayBuffer} data - Source to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {'encrypt' | 'decrypt'} mode - Toggle between encryption and decryption.
 * @returns {Promise<ArrayBuffer>} - Processed result.
 * @private
 */
export async function aesCrypt(
  data: ArrayBuffer,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt',
): Promise<ArrayBuffer> {
  const algo = {
    name: 'AES-GCM',
    iv: aes.iv,
  }
  if (data.byteLength < 1) {
    return new ArrayBuffer(0)
  } else if (mode?.toLowerCase() === 'encrypt') {
    return await crypto.subtle.encrypt(algo, aes.key, data).catch((err) => {
      throw warnError('aesCrypt(encrypt)', err)
    })
  } else {
    return await crypto.subtle.decrypt(algo, aes.key, data).catch((err) => {
      throw warnError('aesCrypt(decrypt)', err)
    })
  }
}

/**
 * Encrypt value using arbitrary ECIES public key.
 * @param {string} pubKey - Public key as hex value.
 * @param {ArrayBuffer} toEncrypt - Value to encrypt.
 * @returns {string} - Encrypted value as hex string.
 * @private
 */
export function eciesEncryptWithPubKey(
  pubKey: string,
  toEncrypt: ArrayBuffer | Uint8Array,
): string {
  if ('buffer' in toEncrypt) {
    return encrypt(pubKey, toEncrypt).toString('hex')
  } else {
    return encrypt(pubKey, new Uint8Array(toEncrypt)).toString('hex')
  }
}

/**
 * Decrypt value using ECIES private key.
 * @param {PrivateKey} key - Private key as ECIES PrivateKey instance.
 * @param {string | Uint8Array} toDecrypt - Value to decrypt.
 * @returns {Uint8Array} - Decrypted value.
 * @private
 */
export function eciesDecryptWithPrivateKey(
  key: PrivateKey,
  toDecrypt: string | Uint8Array,
): Uint8Array {
  const ready =
    toDecrypt instanceof Uint8Array ? toDecrypt : hexToBuffer(toDecrypt)
  return new Uint8Array(decrypt(key.toHex(), ready))
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
  aes: IAesBundle,
): Promise<string> {
  const theIv = eciesEncryptWithPubKey(pubKey, aes.iv)
  const key = await exportJackalKey(aes.key)
  const theKey = eciesEncryptWithPubKey(pubKey, key)
  return `${theIv}|${theKey}`
}

/**
 * Decrypts AES iv/CryptoKey set from string using owner's ECIES private key.
 * @param {PrivateKey} privateKey - Private key as ECIES PrivateKey instance.
 * @param {string} source - String containing encrypted AES iv/CryptoKey set with pipe "|" delimiter.
 * @returns {Promise<IAesBundle>} - Decrypted AES iv/CryptoKey set.
 * @private
 */
export async function stringToAes(
  privateKey: PrivateKey,
  source: string,
): Promise<IAesBundle> {
  try {
    if (source.indexOf('|') < 0) {
      throw new Error('Invalid source string')
    }
    const [iv, key] = source.split('|')
    return {
      iv: eciesDecryptWithPrivateKey(privateKey, iv),
      key: await importJackalKey(eciesDecryptWithPrivateKey(privateKey, key)),
    }
  } catch (err) {
    throw warnError('stringToAes()', err)
  }
}

/**
 * Compresses source string using PLZSU and then encrypts it using AES-256 (AEG-GCM).
 * @param {string} input - Source string.
 * @param {IAesBundle} aes - AES iv/CryptoKey set.
 * @param {boolean} isLedger
 * @returns {Promise<string>} - Compressed and encrypted string.
 * @private
 */
export async function compressEncryptString(
  input: string,
  aes: IAesBundle,
  isLedger: boolean,
): Promise<string> {
  const compressedString = safeCompressData(input)
  return await cryptString(compressedString, aes, 'encrypt', isLedger).catch(
    (err) => {
      warnError('compressEncryptString(encrypt)', err)
      throw err
    },
  )
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
  aes: IAesBundle,
): Promise<string> {
  const safe = prepDecompressionForAmino(input)
  const ready = await cryptString(safe, aes, 'decrypt').catch((err) => {
    warnError('decryptDecompressString(decrypt)', err)
    throw err
  })
  return safeDecompressData(ready)
}

/**
 * Encrypt or decrypt a string using AES-256 (AES-GCM).
 * @param {string} input - Source string to encrypt or decrypt.
 * @param {IAesBundle} aes - AES iv/CryptoKey set. Must match encryption AES set that was used.
 * @param {'encrypt' | 'decrypt'} mode - Toggle between encryption and decryption.
 * @param {boolean} isLedger
 * @returns {Promise<string>} - Processed result.
 * @private
 */
export async function cryptString(
  input: string,
  aes: IAesBundle,
  mode: 'encrypt' | 'decrypt',
  isLedger?: boolean,
): Promise<string> {
  try {
    const uint16 = stringToUint16Array(input)
    const result = await aesCrypt(uint16.buffer, aes, mode)
    const processed = uintArrayToString(new Uint16Array(result))
    if (mode === 'encrypt' && isLedger) {
      return sanitizeCompressionForAmino(processed)
    } else {
      return processed
    }
  } catch (err) {
    throw warnError('cryptString()', err)
  }
}
