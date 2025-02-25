import { describe, expect, test } from 'vitest'
import {
  safeCompressData,
  safeDecompressData,
  unsafeCompressData,
  unsafeDecompressData,
  // sanitizeCompressionForAmino,
  // prepDecompressionForAmino,
  // extractFileMetaData,
  uintArrayToString,
  stringToUint8Array,
  stringToUint16Array,
  intToHex,
  hexToInt,
  secondToMS,
  blockCountUntilTimestamp,
  timestampToBlockHeight,
  // blockToDateFixed
} from '@/utils/converters'

describe('Compression Functions', () => {
  const testString = 'this is my test string'

  test('safeCompressData should prefix string correctly', () => {
    expect(safeCompressData(testString)).toBe('jklpc1஀낖ೠҕୠ伫¦ᘕ퀧『샦䀀')
  })

  test('safeDecompressData should remove prefix correctly', () => {
    const compressed = safeCompressData(testString)
    expect(safeDecompressData(compressed)).toBe(testString)
  })

  test('safeDecompressData should throw error for invalid input', () => {
    expect(() => safeDecompressData('invalid')).toThrow('Invalid Decompression String')
  })

  test('unsafeCompressData and unsafeDecompressData should be inverses', () => {
    const compressed = unsafeCompressData(testString)
    expect(unsafeDecompressData(compressed)).toBe(testString)
  })
})

describe('String Conversion Functions', () => {
  const testStr = 'Hello'
  const testArr = [72, 101, 108, 108, 111]

  test('uintArrayToString should convert array to string', () => {
    const array = new Uint8Array(testArr)
    expect(uintArrayToString(array)).toBe(testStr)
  })

  test('stringToUint8Array should convert string to Uint8Array', () => {
    const uint = stringToUint8Array(testStr)
    expect(Array.from(uint)).toEqual(testArr)
    expect(uint.buffer.byteLength).toBe(5)
  })

  test('stringToUint16Array should convert string to Uint16Array', () => {
    const uint = stringToUint16Array(testStr)
    expect(Array.from(uint)).toEqual(testArr)
    expect(uint.buffer.byteLength).toBe(10)
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
