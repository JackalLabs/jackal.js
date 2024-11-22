import PLZSU from '@karnthis/plzsu'
import { warnError } from '@/utils/misc'
import { assumedBlockTime } from '@/utils/globalDefaults'
import { IBlockTimeOptions, IFileContents, IFileMeta } from '@/interfaces'
import type { TMetaDataSets } from '@/types'

const Plzsu = new PLZSU()
const OneSecondMs = 1000

/**
 * Compresses string using PLZSU compression library.
 * @param {string} input - String to compress.
 * @returns {string} - Compressed string.
 * @private
 */
export function safeCompressData (input: string): string {
  return `jklpc1${Plzsu.compress(input)}`
}

/**
 * Decompresses string using PLZSU compression library.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 * @private
 */
export function safeDecompressData (input: string): string {
  if (!input.startsWith('jklpc1')) {
    throw new Error('Invalid Decompression String')
  }
  return Plzsu.decompress(input.substring(6))
}

/**
 * Compresses string using PLZSU compression library.
 * @param {string} input - String to compress.
 * @returns {string} - Compressed string.
 * @private
 */
export function unsafeCompressData (input: string): string {
  return Plzsu.compress(input)
}

/**
 * Decompresses string using PLZSU compression library.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 * @private
 */
export function unsafeDecompressData (input: string): string {
  return Plzsu.decompress(input)
}

/**
 * Sanitizes input string to Amino-safe compressed value.
 * @param {string} input - String to sanitize and compress.
 * @returns {string} - Compressed Amino-safe string.
 * @private
 */
export function sanitizeCompressionForAmino (input: string): string {
  const uint = stringToUint16Array(input)
  const finalBuf = new Uint8Array(uint.buffer)
  const bufAsString = String.fromCodePoint(...finalBuf)
  return `jklpc2|${btoa(bufAsString)}`
}

/**
 * Decompressed Amino-safe value.
 * @param {string} input - String to decompress.
 * @returns {string} - Decompressed string.
 * @private
 */
export function prepDecompressionForAmino (input: string): string {
  if (input.startsWith('jklpc2|')) {
    const wasBase64 = atob(input.substring(7))
    const asArray = [...wasBase64].map((str) => str.codePointAt(0) || 0)
    return uintArrayToString(Uint8Array.from(asArray))
  } else {
    return input
  }
}

/**
 * Exract meta data attributes from file.
 * @param {File} input - Source file.
 * @returns {IFileMeta} - Extracted meta data attributes.
 * @private
 */
export function extractFileMetaData (input: File): IFileMeta {
  const { lastModified, name, size, type } = input
  return { lastModified, name, size, type }
}

/**
 * Safely converts Uint8Array, Uint16Array, or Uint32Array to string.
 * @param {Uint8Array | Uint16Array | Uint32Array} buf - Data View to convert.
 * @returns {string} - Converted result.
 * @private
 */
export function uintArrayToString (
  buf: Uint8Array | Uint16Array | Uint32Array,
): string {
  return String.fromCharCode.apply(null, [...buf])
}

/**
 * Converts string to Uint8Array.
 * @param {string} str - String to convert.
 * @returns {Uint8Array} - Converted result.
 * @private
 */
export function stringToUint8Array (str: string): Uint8Array {
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
 * @private
 */
export function stringToUint16Array (str: string): Uint16Array {
  const uintView = new Uint16Array(str.length)
  for (let i = 0; i < str.length; i++) {
    uintView[i] = str.charCodeAt(i)
  }
  return uintView
}

/**
 * Hex stringify number.
 * @param {number} [value] - Number to convert. Defaults to 0.
 * @returns {string} - Converted result.
 * @private
 */
export function intToHex (value?: number): string {
  const cleanNumber = Number(value) || 0
  return cleanNumber.toString(16)
}

/**
 * Number from hex string.
 * @param {string} value - String to convert.
 * @returns {number} - Converted result. Defaults to 0.
 * @private
 */
export function hexToInt (value: string): number {
  return parseInt(value, 16) || 0
}

/**
 * Convert number of seconds to number of milliseconds.
 * @param {number} seconds - Number of seconds to convert.
 * @returns {number}
 * @private
 */
export function secondToMS (seconds: number): number {
  return seconds * OneSecondMs
}

/**
 * Estimate number of blocks until specified tiemstamp.
 * @param {number} unixTimestamp - Unix timestamp to estimate until.
 * @returns {number} - Estimated remaining number of blocks.
 * @private
 */
export function blockCountUntilTimestamp (unixTimestamp: number): number {
  const oneMonth = 30 * 24 * 60 * 60 * 1000
  const timeDiff = unixTimestamp - Date.now()
  if (timeDiff < oneMonth) {
    warnError(
      'blockCountUntilTimestamp()',
      'unixTimestamp must be more than 30 days in the future',
    )
    return 0
  }
  return timeDiff * assumedBlockTime
}

/**
 * Estimate block height of a given time stamp.
 * @param {number} unixTimestamp - Unix timestamp to estimate.
 * @param {number} currentHeight - Current block height.
 * @returns {number} - Estimated block height.
 * @private
 */
export function timestampToBlockHeight (
  unixTimestamp: number,
  currentHeight: number,
): number {
  if (unixTimestamp === 0) {
    return 0
  } else {
    return blockCountUntilTimestamp(unixTimestamp) + currentHeight
  }
}

/**
 * Converts chain block height to UTC Date using provided block time value.
 * @param {IBlockTimeOptions} options - Values to use for calculating UTC date.
 * @returns {Date} - Date object for future date matching input future chain height.
 * @private
 */
export function blockToDateFixed (options: IBlockTimeOptions): Date {
  if (!options.blockTime) {
    throw new Error('Block Time is required!')
  }
  const targetHeight = Number(options.targetBlockHeight) || 0
  const blockDiff = targetHeight - options.currentBlockHeight
  const diffMs = blockDiff * options.blockTime
  const now = Date.now()
  return new Date(now + diffMs)
}

/**
 * Make thumbnail if file is supported extension.
 * @param {File} source - File to create thumbnail from.
 * @returns {Promise<string>} - Base64Encode of thumbnail data.
 * @private
 */
export async function maybeMakeThumbnail (source: File): Promise<string> {
  try {
    console.log('Making thumbnail for type....', source.name, source.type)
    if (
      source.type.startsWith('image')
    ) {
      console.log('it is an image!')
      return await convertToWebP(source)
    } else if (
      source.type.startsWith('video')
    ) {
      console.log('it is a video!')
      return await extractThumbnailFromVideo(source)
    } else {
      console.log('it is not convertable :(')
      return ''
    }
  } catch (err) {
    throw warnError('maybeMakeThumbnail()', err)
  }
}

function extractThumbnailFromVideo (file: File): Promise<string> {
  try {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')

      video.src = URL.createObjectURL(file)
      video.muted = true  // Mute the video to prevent sound playing
      video.playsInline = true

      video.onloadedmetadata = () => {
        const duration = video.duration
        const randomTime = Math.random() * duration // Select a random time point in the video
        video.currentTime = randomTime  // Seek to the random time

        video.onseeked = () => {
          // Set the maximum dimension to 256
          const maxSize = 256
          let { videoWidth: width, videoHeight: height } = video

          // Maintain aspect ratio when resizing
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height
              height = maxSize
            }
          }

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          // Set canvas dimensions to the resized dimensions
          canvas.width = width
          canvas.height = height

          // Draw the current video frame onto the resized canvas
          ctx?.drawImage(video, 0, 0, width, height)

          // Convert the canvas to a WebP image
          const base64String = canvas.toDataURL('image/webp', 0.25) // 25% compression
          resolve(base64String)
        }
      }

      video.onerror = reject
    })
  } catch (err) {
    throw warnError('extractThumbnailFromVideo()', err)
  }
}

function convertToWebP (file: File): Promise<string> {
  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string

        img.onload = () => {
          const maxSize = 256
          let { width, height } = img

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height
              height = maxSize
            }
          }

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            return reject('Canvas context is unavailable')
          }

          // Set canvas dimensions to the resized dimensions
          canvas.width = width
          canvas.height = height

          // Draw resized image onto the canvas
          ctx.drawImage(img, 0, 0, width, height)

          // Convert canvas to WebP format and get Base64 string
          canvas.toDataURL('image/webp', 0.25) // 25% compression
          const base64String = canvas.toDataURL('image/webp', 0.25)
          // console.log(base64String)
          resolve(base64String)
        }
      }

      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  } catch (err) {
    throw warnError('convertToWebP()', err)
  }
}

/**
 * Safely stringify FileTree contents for saving to chain.
 * @param {TMetaDataSets} source - Meta data handler export to save.
 * @returns {string}
 */
export function safeStringifyFileTree (source: TMetaDataSets): string {
  try {
    if ('merkleRoot' in source) {
      return JSON.stringify({
        ...source,
        merkleRoot: Array.from(source.merkleRoot),
      })
    } else {
      return JSON.stringify(source)
    }
  } catch (err) {
    throw warnError('safeStringifyFileTree()', err)
  }
}

/**
 * Safely parse JSON stringified contents back to data set including UInt8Array.
 * @param {string} source - JSON stringified contents from FileTree.
 * @returns {TMetaDataSets}
 */
export function safeParseFileTree (source: string): TMetaDataSets {
  try {
    const base = JSON.parse(source)
    if ('merkleRoot' in base) {
      if (Array.isArray(base.merkleRoot)) {
        base.merkleRoot = new Uint8Array(base.merkleRoot)
      } else {
        const sub: number[] = []
        for (const index of Object.keys(base.merkleRoot)) {
          sub.push(base.merkleRoot[index])
        }
        base.merkleRoot = new Uint8Array(sub)
      }
    }
    return base as TMetaDataSets
  } catch (err) {
    throw warnError('safeParseFileTree()', err)
  }
}

/**
 * Safely parse legacy merkle data from FileTree.
 * @param {string} source - JSON stringified contents from FileTree.
 * @returns {IFileContents}
 */
export function safeParseLegacyMerkles (source: string): IFileContents {
  try {
    const base = JSON.parse(source)

    for (let i = 0; i < base.legacyMerkles.lengeth; i++) {
      if (Array.isArray(base.legacyMerkles[i])) {
        base.legacyMerkles[i] = new Uint8Array(base.legacyMerkles[i])
      } else {
        const sub: number[] = []
        for (const index of Object.keys(base.legacyMerkles[i])) {
          sub.push(base.legacyMerkles[i][index])
        }
        base.legacyMerkles[i] = new Uint8Array(sub)
      }
    }
    return base as IFileContents
  } catch (err) {
    throw warnError('safeParseLegacyMerkles()', err)
  }
}
