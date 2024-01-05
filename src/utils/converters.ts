import PLZSU from '@karnthis/plzsu'
import { warnError } from '@/utils/misc'
import { assumedBlockTime } from '@/utils/globalDefaults'
import type { IFileMeta } from '@/interfaces'

const Plzsu = new PLZSU()
const OneSecondMs = 1000

/**
 * Compresses string using PLZSU compression library.
 * @param {string} input - String to compress.
 * @returns {string} - Compressed string.
 */
export function safeCompressData(input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}

/**
 * Decompresses string using PLZSU compression library.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 */
export function safeDecompressData(input: string): string {
  if (!input.startsWith('jklpc1'))
    throw new Error('Invalid Decompression String')
  return Plzsu.decompress(input.substring(6))
}

/**
 * Compresses string using PLZSU compression library.
 * @param {string} input - String to compress.
 * @returns {string} - Compressed string.
 * @private
 */
export function unsafeCompressData(input: string): string {
  return Plzsu.compress(input)
}

/**
 * Decompresses string using PLZSU compression library.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 * @private
 */
export function unsafeDecompressData(input: string): string {
  return Plzsu.decompress(input)
}

/**
 *
 * @param {File} input
 * @returns {IFileMeta}
 */
export function extractFileMetaData(input: File): IFileMeta {
  const { lastModified, name, size, type } = input
  return { lastModified, name, size, type }
}

/**
 * Safely converts Uint8Array, Uint16Array, or Uint32Array to string.
 * @param {Uint8Array | Uint16Array | Uint32Array} buf - Data View to convert.
 * @returns {string} - Converted result.
 */
export function uintArrayToString(buf: Uint8Array | Uint16Array | Uint32Array): string {
  return String.fromCharCode.apply(null, [...buf])
}

/**
 * Converts string to Uint8Array.
 * @param {string} str - String to convert.
 * @returns {Uint8Array} - Converted result.
 */
export function stringToUint8Array(str: string): Uint8Array {
  const uintView = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

/**
 * Converts string to Uint16Array.
 * @param {string} str - String to convert.
 * @returns {Uint16Array} - Converted result.
 */
export function stringToUint16Array(str: string): Uint16Array {
  const uintView = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

/**
 *
 * @param {number} [value]
 * @returns {string}
 */
export function intToHex(value?: number): string {
  const cleanNumber = Number(value) || 0
  return cleanNumber.toString(16)
}

/**
 *
 * @param {string} value
 * @returns {number}
 */
export function hexToInt(value: string): number {
  return parseInt(value, 16) || 0
}

/**
 * Convert number of seconds to number of milliseconds.
 * @param {number} seconds - Number of seconds to convert.
 * @returns {number}
 */
export function secondToMS (seconds: number): number {
  return seconds * OneSecondMs
}

/**
 *
 * @param {number} unixTimestamp
 * @returns {number}
 */
export function blockCountUntilTimestamp(unixTimestamp: number): number {
  const oneMonth = 30 * 24 * 60 * 60 * 1000
  const timeDiff = unixTimestamp - Date.now()
  if (timeDiff < oneMonth) {
    warnError('blockCountUntilTimestamp()', 'unixTimestamp must be more than 30 days in the future')
    return 0
  }
  return timeDiff * assumedBlockTime
}

/**
 *
 * @param {number} unixTimestamp
 * @param {number} currentHeight
 * @returns {number}
 */
export function timestampToBlockHeight(unixTimestamp: number, currentHeight: number): number {
  if (unixTimestamp === 0) {
    return 0
  } else {
    return blockCountUntilTimestamp(unixTimestamp) + currentHeight
  }
}
