import { intToHex, stringToUint8Array } from '@/utils/converters'
import { warnError } from '@/utils/misc'
import type { TMerkleParentChild } from '@/types'
import * as nodeCrypto from 'node:crypto'

/**
 * Hash input using SHA-256, then convert to hex string.
 * @param {string} input - Source string for hashing.
 * @returns {Promise<string>} - Resulting Hex string.
 * @private
 */
export async function hashAndHex (input: string): Promise<string> {
  const algo = 'SHA-256'
  const raw = await crypto.subtle.digest(algo, stringToUint8Array(input))
  return bufferToHex(new Uint8Array(raw))
}

/**
 * Merkle hash owner string for Filetree.
 * @param {string} hexedAddress - Merkled hex string of address.
 * @param {string} owner - Raw owner
 * @returns {Promise<string>} - Merkled, address plus hashed owner.
 * @private
 */
export async function hashAndHexOwner (
  hexedAddress: string,
  owner: string,
): Promise<string> {
  const prefix = 'o'
  return await hashAndHex(`${prefix}${hexedAddress}${await hashAndHex(owner)}`)
}

/**
 * Hash access lookup string for Filetree.
 * @param {string} prefix - Prefix letter.
 * @param {string} trackingNumber - UUID of resource.
 * @param {string} user - Account address.
 * @returns {Promise<string>} - Hashed hex string of inputs.
 * @private
 */
export async function hashAndHexUserAccess (
  prefix: string,
  trackingNumber: string,
  user: string,
): Promise<string> {
  return await hashAndHex(`${prefix}${trackingNumber}${user}`)
}

/**
 * Create a Merkle Hex string.
 * @param {string} path - Hex string to use as base.
 * @param {string} fileName - Raw string that will use hashAndHex() before combining with path.
 * @returns {Promise<string>} - Resulting Merkle Hex string.
 * @private
 */
export async function hexFullPath (
  path: string,
  fileName: string,
): Promise<string> {
  return await hashAndHex(`${path}${await hashAndHex(fileName)}`)
}

/**
 * Create a Merkle Hex string from a directory path.
 * @param {string} path - Directory path as delimited by slashes "/".
 * @returns {Promise<string>} - Resulting Merkle Hex string.
 * @private
 */
export async function merklePath (path: string | string[]): Promise<string> {
  const pathArray = []
  if (path instanceof Array) {
    pathArray.push(...path)
  } else {
    pathArray.push(...path.split('/'))
  }
  let merkle = ''
  for (let i = 0; i < pathArray.length; i++) {
    merkle = await hexFullPath(merkle, pathArray[i])
  }
  return merkle
}

/**
 * Create a Merkle Hex string from a directory path with an index.
 * @param {string} path - Directory path as delimited by slashes "/".
 * @param {number} index - Ref index.
 * @returns {Promise<string>} - Resulting Merkle Hex string.
 * @private
 */
export async function merklePathPlusIndex (
  path: string,
  index: number,
): Promise<string> {
  return await hashAndHex(`${await merklePath(path)}${intToHex(index)}`)
}

/**
 * Create a Merkle Hex string and child string from a directory path.
 * @param {string} path - Directory path as delimited by slashes "/".
 * @returns {Promise<TMerkleParentChild>}
 * @private
 */
export async function merkleParentAndChild (
  path: string,
): Promise<TMerkleParentChild> {
  const pathArray: string[] = path.split('/')
  if (pathArray.length < 2) {
    throw new Error(warnError('merkleParentAndChild()', 'Path too short'))
  }
  const [child] = pathArray.slice(-1)
  let parentMerkle = await merklePath(pathArray.slice(0, -1))
  return [parentMerkle, await hashAndHex(child)]
}

/**
 * Create a Merkle Hex string and child string from a directory path and index.
 * @param {string | string[]} path - Directory path as delimited by slashes "/".
 * @param {string} index - Index to use as child.
 * @returns {Promise<TMerkleParentChild>}
 * @private
 */
export async function merkleParentAndIndex (
  path: string | string[],
  index: string,
): Promise<TMerkleParentChild> {
  const pathArray: string[] = []
  if (path instanceof Array) {
    pathArray.push(...path)
  } else {
    const workingPath = path.split('/')
    pathArray.push(...workingPath)
  }
  let parentMerkle = await merklePath(pathArray)
  return [parentMerkle, index]
}

/**
 * SHA256 hash source string to hex encoded value.
 * @param {string} source - Source string for hashing.
 * @returns {Promise<string>} - Hex encoded SHA string.
 * @private
 */
export async function stringToShaHex (source: string) {
  if (typeof window !== 'undefined') {
    const safe = atob(source)
    const postProcess = await crypto.subtle.digest(
      'SHA-256',
      stringToUint8Array(safe),
    )
    return bufferToHex(new Uint8Array(postProcess))
  } else {
    const safe = Buffer.from(source, 'base64')

    const postProcess = await crypto.subtle.digest(
      'SHA-256',
      safe,
    )
    return bufferToHex(new Uint8Array(postProcess))

    // return nodeCrypto.createHash('sha256').update(safe).digest('hex')
  }
}

/**
 * Converts hashed Uint8Array values into hex strings.
 * @param {Uint8Array} buf - Uint8Array containing hash results.
 * @returns {string} - Hex string converted from source.
 * @private
 */
export function bufferToHex (buf: Uint8Array): string {
  return buf.reduce((acc: string, curr: number) => {
    return acc + hexMap[curr]
  }, '')
}

/**
 * Converts hex strings into hashed Uint8Array values.
 * @param {string} source - Hex string containing hash results.
 * @returns {Uint8Array} - Uint8Array converted from source.
 * @private
 */
export function hexToBuffer (source: string): Uint8Array {
  if (typeof window !== 'undefined') {
    const found: number[] = []
    for (let i = 0; i < source.length; i += 2) {
      found.push(hexMap.indexOf(`${source[i]}${source[i + 1]}`))
    }
    return new Uint8Array(found)
  } else {
    return Buffer.from(source, 'hex')
  }
}

const hexMap: string[] = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '0a',
  '0b',
  '0c',
  '0d',
  '0e',
  '0f',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '1a',
  '1b',
  '1c',
  '1d',
  '1e',
  '1f',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '2a',
  '2b',
  '2c',
  '2d',
  '2e',
  '2f',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '3a',
  '3b',
  '3c',
  '3d',
  '3e',
  '3f',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '4a',
  '4b',
  '4c',
  '4d',
  '4e',
  '4f',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '5a',
  '5b',
  '5c',
  '5d',
  '5e',
  '5f',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '6a',
  '6b',
  '6c',
  '6d',
  '6e',
  '6f',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '77',
  '78',
  '79',
  '7a',
  '7b',
  '7c',
  '7d',
  '7e',
  '7f',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '8a',
  '8b',
  '8c',
  '8d',
  '8e',
  '8f',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99',
  '9a',
  '9b',
  '9c',
  '9d',
  '9e',
  '9f',
  'a0',
  'a1',
  'a2',
  'a3',
  'a4',
  'a5',
  'a6',
  'a7',
  'a8',
  'a9',
  'aa',
  'ab',
  'ac',
  'ad',
  'ae',
  'af',
  'b0',
  'b1',
  'b2',
  'b3',
  'b4',
  'b5',
  'b6',
  'b7',
  'b8',
  'b9',
  'ba',
  'bb',
  'bc',
  'bd',
  'be',
  'bf',
  'c0',
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
  'ca',
  'cb',
  'cc',
  'cd',
  'ce',
  'cf',
  'd0',
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
  'd8',
  'd9',
  'da',
  'db',
  'dc',
  'dd',
  'de',
  'df',
  'e0',
  'e1',
  'e2',
  'e3',
  'e4',
  'e5',
  'e6',
  'e7',
  'e8',
  'e9',
  'ea',
  'eb',
  'ec',
  'ed',
  'ee',
  'ef',
  'f0',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'fa',
  'fb',
  'fc',
  'fd',
  'fe',
  'ff',
]
