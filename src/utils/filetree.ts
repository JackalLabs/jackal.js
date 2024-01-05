import {
  hashAndHexOwner,
  hashAndHexUserAccess,
  merklePath,
  merklePathPlusIndex,
} from '@/utils/hash'
import { tidyString, warnError } from '@/utils/misc'
import { aesToString, cryptString, stringToAes } from '@/utils/crypt'
import { intToHex, safeDecompressData } from '@/utils/converters'
import type {
  DFile,
  DQueryFileTreeFile,
  IJackalSigningStargateClient,
} from '@jackallabs/jackal.js-protos'
import type { IAesBundle, IClientHandler } from '@/interfaces'
import type { TMetaDataSets } from '@/types'

/**
 *
 * @param {string} path
 * @param {string} owner
 * @param {number} [index]
 * @returns {Promise<DQueryFileTreeFile>}
 * @private
 */
export async function readFileTreePath(
  path: string,
  owner: string,
  index?: number,
): Promise<DQueryFileTreeFile> {
  const hexAddress =
    Number(index) > -1
      ? await merklePathPlusIndex(path, intToHex(index))
      : await merklePath(path)
  return {
    address: hexAddress,
    ownerAddress: await hashAndHexOwner(hexAddress, owner),
  }
}

/**
 *
 * @param {string} trackingNumber
 * @param {string[]} editors
 * @returns {Promise<string>}
 * @private
 */
export async function createEditAccess(
  trackingNumber: string,
  editors: string[],
): Promise<string> {
  const editAccess: Record<string, 'valid'> = {}
  for (let editor of editors) {
    const entry = await hashAndHexUserAccess('e', trackingNumber, editor)
    editAccess[entry] = 'valid'
  }
  return JSON.stringify(editAccess)
}

/**
 *
 * @param {string} trackingNumber
 * @param {string[]} viewers
 * @param {IClientHandler} [client]
 * @param {IAesBundle} [aes]
 * @returns {Promise<string>}
 * @private
 */
export async function createViewAccess(
  trackingNumber: string,
  viewers: string[],
  client?: IClientHandler,
  aes?: IAesBundle,
): Promise<string> {
  const viewAccess: Record<string, string> = {}
  for (let viewer of viewers) {
    const entry = await hashAndHexUserAccess('v', trackingNumber, viewer)
    if (aes && client) {
      const pubKey =
        viewer === client.getJackalAddress()
          ? client.getPubKey()
          : await client.findPubKey(viewer)
      viewAccess[entry] = await aesToString(pubKey, aes)
    } else {
      viewAccess[entry] = 'public'
    }
  }
  return JSON.stringify(viewAccess)
}

/**
 *
 * @param {string} key
 * @param {string} viewingAccess
 * @param {string} trackingNumber
 * @param {string} userAddress
 * @returns {Promise<IAesBundle>}
 * @private
 */
export async function extractViewAccess(
  key: string,
  viewingAccess: string,
  trackingNumber: string,
  userAddress: string,
): Promise<IAesBundle> {
  try {
    const parsedAccess = JSON.parse(viewingAccess)
    const user = await hashAndHexUserAccess('v', trackingNumber, userAddress)
    if (user in parsedAccess) {
      return await stringToAes(key, parsedAccess[user])
    } else {
      throw warnError('extractViewAccess()', 'Not an authorized Viewer')
    }
  } catch (err) {
    // warnError('extractViewAccess()', `Unrecognized viewingAccess format:\n\n${viewingAccess}`)
    throw warnError('extractViewAccess()', err)
  }
}

/**
 *
 * @param {string} key
 * @param {DFile} fileTreeData
 * @param {string} userAddress
 * @returns {Promise<TMetaDataSets>}
 * @private
 */
export async function decryptAndParseContents(
  key: string,
  fileTreeData: DFile,
  userAddress: string,
): Promise<TMetaDataSets> {
  const { viewingAccess, trackingNumber, contents } = fileTreeData
  const aes = await extractViewAccess(
    key,
    viewingAccess,
    trackingNumber,
    userAddress,
  )
  let decrypted = await cryptString(contents, aes, 'decrypt').catch((err) => {
    throw warnError('decryptAndParseContents()', err)
  })
  warnError('decryptAndParseContents()', 'decrypted 1')
  if (decrypted.startsWith('jklpc1')) {
    decrypted = safeDecompressData(decrypted)
  }
  warnError('decryptAndParseContents()', 'decrypted 2')
  try {
    return JSON.parse(decrypted)
  } catch (err) {
    throw warnError('decryptAndParseContents()', err)
  }
}

/**
 *
 * @param {IJackalSigningStargateClient} client
 * @param {string} key
 * @param {string} userAddress
 * @param {string} storageAddress
 * @param {string} basePath
 * @param {number} [index]
 * @returns {Promise<TMetaDataSets>}
 * @private
 */
export async function loadFileTreeMetaData(
  client: IJackalSigningStargateClient,
  key: string,
  userAddress: string,
  storageAddress: string,
  basePath: string,
  index?: number,
): Promise<TMetaDataSets> {
  const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
    tidyString(`${basePath}/${storageAddress}`, '/'),
    userAddress,
    index,
  ).catch((err: Error) => {
    throw warnError('loadFileTreeMetaData()', err)
  })
  console.log('directoryLookup:', directoryLookup)
  const { file } = await client.queries.fileTree
    .file(directoryLookup)
    .catch((err: Error) => {
      throw warnError('loadFileTreeMetaData()', err)
    })
  if (file.contents.includes('metaDataType')) {
    warnError('loadFileTreeMetaData()', 'JSON parsing')
    warnError('loadFileTreeMetaData()', file.contents)
    return JSON.parse(file.contents)
  } else if (file.contents.length > 0) {
    warnError('loadFileTreeMetaData()', 'decrypting and parsing')
    return await decryptAndParseContents(key, file, userAddress).catch(
      (err) => {
        throw warnError('loadFileTreeMetaData()', err)
      },
    )
  } else {
    throw new Error(
      warnError('loadFileTreeMetaData()', `Empty contents for ${basePath}`),
    )
  }
}
