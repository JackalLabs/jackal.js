import {
  createViewAccess,
  extractViewAccess,
  loadFileTreeMetaData,
} from '@/utils/filetree'
import { cryptString } from '@/utils/crypt'
import { hexToInt } from '@/utils/converters'
import { warnError } from '@/utils/misc'
import type { PrivateKey } from 'eciesjs'
import type {
  DNotification,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type { TSharedMetaData } from '@/types'
import type {
  IAesBundle,
  IClientHandler,
  IFolderMetaData,
  INotification,
  INotificationRecord,
  IPrivateNotification,
  ISharedMetaDataMap,
  IShareMetaData,
} from '@/interfaces'

export function formatNotification(msg: string): INotification {
  return {
    msg,
  }
}

export function formatShareNotification(
  path: string,
  isFile: boolean,
): INotification {
  const msg = `${isFile ? 'file' : 'folder'}|${path}`
  return formatNotification(msg)
}

export async function protectNotification(
  jackalClient: IClientHandler,
  senderAddress: string,
  receiverAddress: string,
  aes: IAesBundle,
): Promise<string> {
  return await createViewAccess(
    '',
    [senderAddress, receiverAddress],
    jackalClient,
    aes,
  )
}

export async function readShareNotification(
  key: PrivateKey,
  notificationData: DNotification,
  userAddress: string,
): Promise<INotificationRecord> {
  try {
    const contents: IPrivateNotification = JSON.parse(notificationData.contents)
    const aes = await extractViewAccess(key, contents.keys, '', userAddress)
    console.log('contents:', contents)
    const msg = await cryptString(contents.msg, aes, 'decrypt', false)
    console.log('aes:', aes)
    console.log('notificationData:', notificationData)
    return {
      sender: notificationData.from,
      receiver: notificationData.to,
      msg,
    }
  } catch (err) {
    throw warnError('readShareNotification()', err)
  }
}

export async function loadSingleSharingFolder(
  client: TJackalSigningClient,
  key: PrivateKey,
  userAddress: string,
  path: string,
) {
  try {
    const data: ISharedMetaDataMap = {}
    const parsed = await loadFileTreeMetaData(
      client,
      key,
      userAddress,
      '',
      path,
    )
    console.log('single parsed:', parsed)

    if (parsed && 'count' in parsed) {
      const metaData = parsed as IFolderMetaData
      const indexCount = hexToInt(metaData.count)
      for (let i = 0; i < indexCount; i++) {
        const unsorted = await loadFileTreeMetaData(
          client,
          key,
          userAddress,
          '',
          path,
          i,
        ).catch(() => {
          console.log('caught')
        })
        if (!unsorted) {
          continue
        }
        console.log('unsorted:', unsorted)

        const meta = unsorted as TSharedMetaData
        const name = meta.pointsTo.split('/').pop() as string
        if (meta.metaDataType === 'shareref') {
          console.log('shareref target:', meta.pointsTo)
          const share = await loadFileTreeMetaData(
            client,
            key,
            userAddress,
            '',
            meta.pointsTo,
          ).catch(() => {
            console.log('caught')
          })
          if (!share) {
            continue
          }
          data[name] = share as IShareMetaData
        } else {
          data[name] = await loadSingleSharingFolder(
            client,
            key,
            userAddress,
            meta.pointsTo,
          )
        }
      }
    }
    return data
  } catch (err) {
    throw warnError('loadSingleSharingFolder()', err)
  }
}
