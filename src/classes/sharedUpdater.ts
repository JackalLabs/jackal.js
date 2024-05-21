import { readShareNotification } from '@/utils/notifications'
import {
  findNestedContentsCount,
  findNestedSharedDepth,
  warnError,
} from '@/utils/misc'
import { MetaHandler } from '@/classes/metaHandler'
import { sharedPath } from '@/utils/globalDefaults'
import { EncodingHandler } from '@/classes/encodingHandler'
import { genAesBundle } from '@/utils/crypt'
import type { PrivateKey } from 'eciesjs'
import type {
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type {
  IClientHandler,
  IMetaHandler,
  INotificationRecord,
  ISharedUpdater,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSharedRootMetaDataMap } from '@/types'

export class SharedUpdater extends EncodingHandler implements ISharedUpdater {
  protected readonly keyPair: PrivateKey
  protected readonly shared: TSharedRootMetaDataMap

  protected readonly notifications: INotificationRecord[]
  protected readonly existingPaths: Record<string, IMetaHandler>
  protected readonly addedSharer: Record<string, IMetaHandler>
  protected readonly addedMiddle: Record<string, IMetaHandler>
  protected readonly addedShared: Record<string, IMetaHandler>

  constructor(
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
    shared: TSharedRootMetaDataMap,
  ) {
    super(client, jackalSigner, hostSigner)
    this.keyPair = keyPair
    this.shared = shared

    this.notifications = []
    this.existingPaths = {}
    this.addedSharer = {}
    this.addedMiddle = {}
    this.addedShared = {}
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async fetchNotifications(): Promise<number> {
    try {
      const raw =
        await this.jackalSigner.queries.notifications.allNotificationsByAddress(
          { to: this.jklAddress },
        )
      for (let one of raw.notifications) {
        this.notifications.push(
          await readShareNotification(this.keyPair, one, this.jklAddress),
        )
      }
      return this.notifications.length
    } catch (err) {
      throw warnError('SharedUpdater fetchNotifications()', err)
    }
  }

  async digest(): Promise<void> {
    try {
      for (let one of this.notifications) {
        if (one.msg.startsWith('file|')) {
          const msgTrimmed = one.msg.slice(5)
          const chunked = msgTrimmed.replace('s/Home/', '').split('/')

          await this.maybeMakeSharer(one.sender)

          const name = chunked.pop() as string
          let finalName = ''
          if (chunked.length > 0) {
            const depth = findNestedSharedDepth(
              this.shared[one.sender],
              chunked,
            )
            const subChunked = chunked.slice(0, depth)
            const size = findNestedContentsCount(
              this.shared[one.sender],
              subChunked,
            )

            const parentName = [
              's',
              sharedPath,
              one.sender,
              ...subChunked,
            ].join('/')
            if (parentName in this.existingPaths) {
              this.existingPaths[parentName].addToCount(1)
            } else {
              this.existingPaths[parentName] = await MetaHandler.create(
                parentName,
                {
                  count: size + 1,
                },
              )
            }

            const fresh = this.makeFreshFolders(one.sender, chunked, depth)
            for (let path of fresh) {
              if (path in this.addedMiddle) {
                this.addedMiddle[path].addToCount(1)
              } else {
                this.addedMiddle[path] = await MetaHandler.create(path, {
                  count: 1,
                })
                this.addedMiddle[path].setRefIndex(this.findRefIndex(path))
              }
            }
            finalName = ['s', sharedPath, one.sender, ...chunked, name].join(
              '/',
            )
          } else {
            finalName = ['s', sharedPath, one.sender, name].join('/')
          }
          this.addedShared[finalName] = await MetaHandler.create(finalName, {
            pointsTo: msgTrimmed,
            owner: one.sender,
          })
          this.addedShared[finalName].setRefIndex(this.findRefIndex(finalName))
        }
      }

      const msgQueue = await this.buildMsgQueue()
      if (msgQueue.length > 0) {
        const postBroadcast =
          await this.jackalClient.broadcastAndMonitorMsgs(msgQueue)
        console.log('resp:', postBroadcast.txResponse)
      }
    } catch (err) {
      throw warnError('SharedUpdater digest()', err)
    }
  }

  protected async maybeMakeSharer(sender: string): Promise<void> {
    const path = `s/${sharedPath}/${sender}`
    if (path in this.existingPaths) {
      this.existingPaths[path].addToCount(1)
    } else {
      if (sender in this.shared) {
        this.existingPaths[path] = await MetaHandler.create(path, {
          count: Object.keys(this.shared[sender]).length + 1,
        })
      } else {
        const meta = await MetaHandler.create(path, {
          count: 1,
        })
        meta.setRefIndex(Object.keys(this.shared).length)
        this.addedSharer[path] = meta
        this.shared[sender] = {}
      }
    }
  }

  protected makeFreshFolders(
    sender: string,
    base: string[],
    offset: number,
  ): string[] {
    const full: string[] = []
    for (let i = offset + 2; i <= base.length; i++) {
      const path = ['s', sharedPath, sender, ...base.slice(0, i)].join('/')
      full.push(path)
    }
    return full
  }

  protected findRefIndex(path: string): number {
    const chunks = path.split('/')
    chunks.pop()
    const target = chunks.join('/')
    if (target in this.existingPaths) {
      return this.existingPaths[target].getCount() - 1
    } else if (target in this.addedSharer) {
      return this.addedSharer[target].getCount() - 1
    } else {
      return this.addedMiddle[target].getCount() - 1
    }
  }

  protected async buildMsgQueue(): Promise<IWrappedEncodeObject[]> {
    try {
      const msgs: IWrappedEncodeObject[] = []
      for (let name in this.existingPaths) {
        const existingMsgs = await this.existingFolderToMsgs({
          meta: this.existingPaths[name],
          aes: await genAesBundle(),
        })
        msgs.push(...existingMsgs)
      }

      if (Object.keys(this.addedSharer).length > 0) {
        const sharedMeta = await MetaHandler.create(`s/${sharedPath}`, {
          count: Object.keys(this.shared).length,
        })
        for (let name in this.addedSharer) {
          this.addedSharer[name].setRefIndex(sharedMeta.getCount())
          sharedMeta.addToCount(1)
          const addedSharerMsgs = await this.sharedFolderToMsgs({
            meta: this.addedSharer[name],
            aes: await genAesBundle(),
          })
          msgs.push(...addedSharerMsgs)
        }
        const parentMsgs = await this.existingFolderToMsgs({
          meta: sharedMeta,
          aes: await genAesBundle(),
        })
        msgs.push(...parentMsgs)
      }

      const sortedAdditions = Object.keys(this.addedMiddle).sort(
        (a, b) => a.length - b.length,
      )
      for (let name of sortedAdditions) {
        const addedMiddleMsgs = await this.folderToMsgs({
          meta: this.addedMiddle[name],
          aes: await genAesBundle(),
        })
        msgs.push(...addedMiddleMsgs)
      }

      for (let name in this.addedShared) {
        const addedSharedMsgs = await this.sharedFileToMsgs({
          meta: this.addedShared[name],
          aes: await genAesBundle(),
        })
        msgs.push(...addedSharedMsgs)
      }

      return msgs
    } catch (err) {
      throw warnError('SharedUpdater buildMsgQueue()', err)
    }
  }
}
