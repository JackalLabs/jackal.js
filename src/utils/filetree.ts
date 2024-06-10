import { hashAndHex, hashAndHexOwner, hashAndHexUserAccess, merklePath, merklePathPlusIndex } from '@/utils/hash'
import { tidyString, warnError } from '@/utils/misc'
import { aesToString, compressEncryptString, cryptString, stringToAes } from '@/utils/crypt'
import { intToHex, prepDecompressionForAmino, safeDecompressData } from '@/utils/converters'
import { MetaHandler } from '@/classes/metaHandler'
import type {
  DEncodeObject,
  DFile,
  DMsgFileTreePostFile,
  DQueryFileTreeFile,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import {
  IAesBundle,
  IClientHandler,
  IFileMeta,
  IFileTreeOptions,
  ILegacyMetaData,
  IMetaHandler,
  IReconstructedFileTree,
  TConversionStatusBundle,
} from '@/interfaces'
import type { TMerkleParentChild, TMetaDataSets } from '@/types'
import type { PrivateKey } from 'eciesjs'
import type { IFileContents } from '@/interfaces/jjs_v2'

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
  try {
    const hexAddress =
      Number(index) > -1
        ? await merklePathPlusIndex(path, intToHex(index))
        : await merklePath(path)

    return {
      address: hexAddress,
      ownerAddress: await hashAndHexOwner(hexAddress, owner),
    }
  } catch (err) {
    throw warnError('readFileTreePath()', err)
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
  try {
    const editAccess: Record<string, 'valid'> = {}
    for (let editor of editors) {
      const entry = await hashAndHexUserAccess('e', trackingNumber, editor)
      editAccess[entry] = 'valid'
    }
    return JSON.stringify(editAccess)
  } catch (err) {
    throw warnError('createEditAccess()', err)
  }
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
  try {
    const viewAccess: Record<string, string> = {}
    for (let viewer of viewers) {
      const entry = await hashAndHexUserAccess('v', trackingNumber, viewer)
      if (aes && client) {
        const pubKey = await client.findPubKey(viewer)
        viewAccess[entry] = await aesToString(pubKey, aes)
      } else {
        viewAccess[entry] = 'public'
      }
    }
    return JSON.stringify(viewAccess)
  } catch (err) {
    throw warnError('createViewAccess()', err)
  }
}

/**
 *
 * @param {PrivateKey} key
 * @param {string} viewingAccess
 * @param {string} trackingNumber
 * @param {string} userAddress
 * @returns {Promise<IAesBundle>}
 * @private
 */
export async function extractViewAccess(
  key: PrivateKey,
  viewingAccess: string,
  trackingNumber: string,
  userAddress: string,
): Promise<IAesBundle> {
  try {
    const parsedAccess = JSON.parse(viewingAccess)
    const user = await hashAndHexUserAccess('v', trackingNumber, userAddress)
    console.log('userAddress:', userAddress)
    console.log('user:', user)
    if (user in parsedAccess) {
      return await stringToAes(key, parsedAccess[user])
    } else {
      throw new Error('Not an authorized Viewer')
    }
  } catch (err) {
    throw warnError('extractViewAccess()', err)
  }
}

/**
 *
 * @param {string} editAccess
 * @param {string} trackingNumber
 * @param {string} userAddress
 * @returns {Promise<boolean>}
 * @private
 */
export async function extractEditAccess(
  editAccess: string,
  trackingNumber: string,
  userAddress: string,
): Promise<boolean> {
  try {
    const parsedAccess = JSON.parse(editAccess)
    const user = await hashAndHexUserAccess('e', trackingNumber, userAddress)
    return user in parsedAccess
  } catch (err) {
    throw warnError('extractEditAccess()', err)
  }
}

/**
 *
 * @param {PrivateKey} key
 * @param {DFile} fileTreeData
 * @param {string} userAddress
 * @returns {Promise<TMetaDataSets>}
 * @private
 */
export async function parseMetaFromEncryptedContents(
  key: PrivateKey,
  fileTreeData: DFile,
  userAddress: string,
): Promise<TMetaDataSets> {
  try {
    const data = await decryptAndParseContents(key, fileTreeData, userAddress)
    return data as TMetaDataSets
  } catch (err) {
    throw warnError('parseMetaFromEncryptedContents()', err)
  }
}

/**
 *
 * @param {PrivateKey} key
 * @param {DFile} fileTreeData
 * @param {string} userAddress
 * @returns {Promise<Record<string, any>>}
 * @private
 */
export async function decryptAndParseContents(
  key: PrivateKey,
  fileTreeData: DFile,
  userAddress: string,
): Promise<Record<string, any>> {
  try {
    const { viewingAccess, trackingNumber, contents } = fileTreeData
    const safe = prepDecompressionForAmino(contents)
    const aes = await extractViewAccess(
      key,
      viewingAccess,
      trackingNumber,
      userAddress,
    )
    let decrypted = await cryptString(safe, aes, 'decrypt')
    if (decrypted.startsWith('jklpc1')) {
      decrypted = safeDecompressData(decrypted)
    }
    return JSON.parse(decrypted)
  } catch (err) {
    throw warnError('decryptAndParseContents()', err)
  }
}

/**
 *
 * @param {TJackalSigningClient} client
 * @param {PrivateKey} key
 * @param {string} userAddress
 * @param {string} storageAddress
 * @param {string} basePath
 * @returns {Promise<IConversionStatusBundle>}
 */
export async function loadFolderFileTreeMetaData(
  client: TJackalSigningClient,
  key: PrivateKey,
  userAddress: string,
  storageAddress: string,
  basePath: string,
): Promise<TConversionStatusBundle> {
  try {
    const tidyAddress = tidyString(`${basePath}/${storageAddress}`, '/')
    const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
      tidyAddress,
      userAddress,
    )
    console.log(directoryLookup)
    const { file } = await client.queries.fileTree.file(directoryLookup)
    const { editAccess, contents, trackingNumber } = file
    const access = await extractEditAccess(
      editAccess,
      trackingNumber,
      userAddress,
    )

    let requiresConversion = false
    if (access) {
      switch (true) {
        case contents.includes('metaDataType'):
          return {
            requiresConversion,
            metaData: JSON.parse(contents),
          }
        case contents.length > 0:
          return {
            requiresConversion: true,
            metaData: (await decryptAndParseContents(
              key,
              file,
              userAddress,
            )) as ILegacyMetaData,
          }
        default:
          throw new Error(`Empty contents for ${tidyAddress}`)
      }
    } else {
      throw new Error('Not Authorized')
    }
  } catch (err) {
    throw warnError('loadFolderFileTreeMetaData()', err)
  }
}

/**
 *
 * @param {TJackalSigningClient} client
 * @param {PrivateKey} key
 * @param {string} userAddress
 * @param {string} storageAddress
 * @param {string} basePath
 * @param {number} [index]
 * @returns {Promise<TMetaDataSets>}
 * @private
 */
export async function loadFileTreeMetaData(
  client: TJackalSigningClient,
  key: PrivateKey,
  userAddress: string,
  storageAddress: string,
  basePath: string,
  index?: number,
): Promise<TMetaDataSets> {
  return loadExternalFileTreeMetaData(
    client,
    key,
    userAddress,
    userAddress,
    storageAddress,
    basePath,
    index,
  )
}

/**
 *
 * @param {TJackalSigningClient} client
 * @param {PrivateKey} key
 * @param {string} ownerAddress
 * @param {string} readerAddress
 * @param {string} storageAddress
 * @param {string} basePath
 * @param {number} [index]
 * @returns {Promise<TMetaDataSets>}
 */
export async function loadExternalFileTreeMetaData(
  client: TJackalSigningClient,
  key: PrivateKey,
  ownerAddress: string,
  readerAddress: string,
  storageAddress: string,
  basePath: string,
  index?: number,
): Promise<TMetaDataSets> {
  try {
    const tidyAddress = tidyString(`${basePath}/${storageAddress}`, '/')
    const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
      tidyAddress,
      ownerAddress,
      index,
    )
    console.log(directoryLookup)
    const { file } = await client.queries.fileTree.file(directoryLookup)
    const { editAccess, contents, trackingNumber } = file
    const access = await extractEditAccess(
      editAccess,
      trackingNumber,
      readerAddress,
    )

    if (access) {
      switch (true) {
        case contents.includes('metaDataType'):
          return JSON.parse(contents)
        case contents.includes('legacyMerkle'):
          const { legacyMerkle } = JSON.parse(contents) as IFileContents
          const addressBlock = tidyAddress.split('/')
          const subAddress = addressBlock.slice(0, -1).join('/')
          const [name] = addressBlock.slice(-1)

          const parent = await loadFolderFileTreeMetaData(
            client,
            key,
            readerAddress,
            '',
            subAddress,
          )
          if (parent.requiresConversion) {
            const meta = await MetaHandler.create(subAddress, {
              legacyMerkle,
              fileMeta: parent.metaData.fileChildren[name],
            })
            return meta.getFileMeta()
          } else {
            throw new Error('Conversion Mismatch')
          }
        case contents.length > 0:
          return await parseMetaFromEncryptedContents(key, file, readerAddress)
        default:
          throw new Error(`Empty contents for ${tidyAddress}`)
      }
    } else {
      throw new Error('Not Authorized')
    }
  } catch (err) {
    throw warnError('loadFileTreeMetaData()', err)
  }
}

export async function getLegacyMerkle(
  client: TJackalSigningClient,
  ownerAddress: string,
  fileAddress: string,
  basePath: string,
  fileMeta: IFileMeta,
): Promise<IMetaHandler> {
  try {
    const tidyAddress = tidyString(`${basePath}/${fileAddress}`, '/')
    const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
      tidyAddress,
      ownerAddress,
    )
    console.log(directoryLookup)
    const { file } = await client.queries.fileTree.file(directoryLookup)
    const { editAccess, contents, trackingNumber } = file
    const access = await extractEditAccess(
      editAccess,
      trackingNumber,
      ownerAddress,
    )

    if (access) {
      const { legacyMerkle } = JSON.parse(contents) as IFileContents
      return await MetaHandler.create(tidyAddress, { legacyMerkle, fileMeta })
    } else {
      throw new Error('Not Authorized')
    }
  } catch (err) {
    throw warnError('getLegacyMerkle()', err)
  }
}

/**
 *
 * @param {IClientHandler} client
 * @param {TJackalSigningClient} signer
 * @param {PrivateKey} key
 * @param {string} userAddress
 * @param {string[]} additionalViewers
 * @param {string} path
 * @returns {Promise<IReconstructedFileTree>}
 */
export async function reconstructFileTreeMetaData(
  client: IClientHandler,
  signer: TJackalSigningClient,
  key: PrivateKey,
  userAddress: string,
  additionalViewers: string[],
  path: string,
): Promise<IReconstructedFileTree> {
  try {
    const allViewers = [userAddress, ...additionalViewers]
    const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
      path,
      userAddress,
    )
    const {
      file: { contents, viewingAccess, editAccess, trackingNumber },
    } = await signer.queries.fileTree.file(directoryLookup)
    const access = await extractEditAccess(
      editAccess,
      trackingNumber,
      userAddress,
    )
    if (access) {
      if (contents.includes('metaDataType')) {
        return {
          contents,
          viewers: await createViewAccess(trackingNumber, allViewers),
          editors: await createEditAccess(trackingNumber, [userAddress]),
          trackingNumber,
        }
      } else if (contents.length > 0) {
        const aes = await extractViewAccess(
          key,
          viewingAccess,
          trackingNumber,
          userAddress,
        )
        return {
          contents,
          viewers: await createViewAccess(
            trackingNumber,
            allViewers,
            client,
            aes,
          ),
          editors: await createEditAccess(trackingNumber, [userAddress]),
          trackingNumber,
        }
      } else {
        throw new Error(`Empty contents for ${path}`)
      }
    } else {
      throw new Error('Not Authorized')
    }
  } catch (err) {
    throw warnError('loadFileTreeMetaData()', err)
  }
}

/**
 *
 * @param {TJackalSigningClient} client
 * @param {PrivateKey} key
 * @param {string} ownerAddress
 * @param {string} readerAddress
 * @param {string} storageAddress
 * @param {string} basePath
 * @returns {Promise<IAesBundle>}
 */
export async function loadKeysFromFileTree(
  client: TJackalSigningClient,
  key: PrivateKey,
  ownerAddress: string,
  readerAddress: string,
  storageAddress: string,
  basePath: string,
): Promise<IAesBundle> {
  try {
    const tidyAddress = tidyString(`${basePath}/${storageAddress}`, '/')
    const directoryLookup: DQueryFileTreeFile = await readFileTreePath(
      tidyAddress,
      ownerAddress,
    )
    const {
      file: { viewingAccess, trackingNumber },
    } = await client.queries.fileTree.file(directoryLookup)

    return await extractViewAccess(
      key,
      viewingAccess,
      trackingNumber,
      readerAddress,
    )
  } catch (err) {
    throw warnError('loadKeysFromFileTree()', err)
  }
}

/**
 *
 * @param {string} userAddress
 * @param {TMerkleParentChild} location
 * @param {IReconstructedFileTree} ready
 * @returns {Promise<DMsgFileTreePostFile>}
 */
export async function reEncodeFileTreePostFile(
  userAddress: string,
  location: TMerkleParentChild,
  ready: IReconstructedFileTree,
): Promise<DMsgFileTreePostFile> {
  const [hashParent, hashChild] = location
  return {
    creator: userAddress,
    account: await hashAndHex(userAddress),
    hashParent,
    hashChild,
    ...ready,
  }
}

/**
 *
 * @param {IClientHandler} jackalClient
 * @param {string} userAddress
 * @param {TMerkleParentChild} location
 * @param {TMetaDataSets} meta
 * @param {IFileTreeOptions} [options]
 * @returns {Promise<DEncodeObject>}
 */
export async function encodeFileTreePostFile(
  jackalClient: IClientHandler,
  userAddress: string,
  location: TMerkleParentChild,
  meta: TMetaDataSets,
  options: IFileTreeOptions = {},
): Promise<DEncodeObject> {
  try {
    const { additionalViewers = [], aes = null } = options
    const [hashParent, hashChild] = location
    const allViewers = [userAddress, ...additionalViewers]

    const forFileTree: DMsgFileTreePostFile = {
      creator: userAddress,
      account: await hashAndHex(userAddress),
      hashParent,
      hashChild,
      contents: '',
      viewers: '',
      editors: '',
      trackingNumber: '',
    }
    const trackingNumber = crypto.randomUUID()
    const stringedMeta = JSON.stringify(meta)
    if (aes) {
      forFileTree.contents = await compressEncryptString(
        stringedMeta,
        aes,
        jackalClient.getIsLedger(),
      )
      forFileTree.viewers = await createViewAccess(
        trackingNumber,
        allViewers,
        jackalClient,
        aes,
      )
      forFileTree.editors = await createEditAccess(trackingNumber, [
        userAddress,
      ])
      forFileTree.trackingNumber = trackingNumber
    } else {
      forFileTree.contents = stringedMeta
      forFileTree.viewers = await createViewAccess(trackingNumber, allViewers)
      forFileTree.editors = await createEditAccess(trackingNumber, [
        userAddress,
      ])
      forFileTree.trackingNumber = trackingNumber
    }
    return jackalClient.getTxs().fileTree.msgPostFile(forFileTree)
  } catch (err) {
    throw warnError('encodeFileTreePostFile()', err)
  }
}
