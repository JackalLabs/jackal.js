import { describe, expect, test } from 'vitest'
import {
  safeCompressData,
  safeDecompressData,
  unsafeCompressData,
  unsafeDecompressData,
  sanitizeCompressionForAmino,
  prepDecompressionForAmino,
  extractFileMetaData,
  uintArrayToString,
  stringToUint8Array,
  stringToUint16Array,
  intToHex,
  hexToInt, 
  secondToMS,
  blockCountUntilTimestamp,
  timestampToBlockHeight,
  blockToDateFixed
} from '@/utils/converters'

describe('Compression Functions', () => {
  test('safeCompressData should prefix string correctly', () => {
    expect(safeCompressData('test')).toBe('jklpc3|test')
  })

  test('safeDecompressData should remove prefix correctly', () => {
    expect(safeDecompressData('jklpc3|test')).toBe('test')
  })

  test('safeDecompressData should throw error for invalid input', () => {
    expect(() => safeDecompressData('invalid')).toThrow('Invalid Decompression String')
  })

  test('unsafeCompressData and unsafeDecompressData should be inverses', () => {
    const input = 'sample text'
    const compressed = unsafeCompressData(input)
    expect(unsafeDecompressData(compressed)).toBe(input)
  })
})

describe('String Conversion Functions', () => {
  test('uintArrayToString should convert array to string', () => {
    const array = new Uint8Array([65, 66, 67])
    expect(uintArrayToString(array)).toBe('ABC')
  })

  test('stringToUint8Array should convert string to Uint8Array', () => {
    const str = 'Hello'
    expect(Array.from(stringToUint8Array(str))).toEqual([72, 101, 108, 108, 111])
  })

  test('stringToUint16Array should convert string to Uint16Array', () => {
    const str = 'Hello'
    expect(Array.from(stringToUint16Array(str))).toEqual([72, 101, 108, 108, 111])
  })
})

describe('Hexadecimal Conversion Functions', () => {
  test('intToHex should correctly convert numbers to hex', () => {
    expect(intToHex(255)).toBe('ff')
    expect(intToHex(16)).toBe('10')
    expect(intToHex()).toBe('0')
  })

  test('hexToInt should correctly convert hex to numbers', () => {
    expect(hexToInt('ff')).toBe(255)
    expect(hexToInt('10')).toBe(16)
    expect(hexToInt('invalid')).toBe(0)
  })
})

describe('Timestamp & Block Calculation Functions', () => {
  test('secondToMS should correctly convert seconds to milliseconds', () => {
    expect(secondToMS(1)).toBe(1000)
    expect(secondToMS(60)).toBe(60000)
  })

  test('blockCountUntilTimestamp should return 0 for timestamps within 30 days', () => {
    const timestamp = Date.now() + 1000 * 60 * 60 * 24 * 29 // 29 days in future
    expect(blockCountUntilTimestamp(timestamp)).toBe(0)
  })

  test('timestampToBlockHeight should return correct block height', () => {
    expect(timestampToBlockHeight(Date.now() + 1000 * 60 * 60 * 24 * 40, 1000)).toBeGreaterThan(1000)
  })
})
