import { findNestedContentsCount, findNestedSharedDepth, warnError } from '@/utils/misc'
import { ShareFolderMetaHandler, ShareMetaHandler } from '@/classes/metaHandlers'
import { sharedPath } from '@/utils/globalDefaults'
import { EncodingHandler } from '@/classes/encodingHandler'
import { genAesBundle } from '@/utils/crypt'
import type { PrivateKey } from 'eciesjs'
import type { THostSigningClient, TJackalSigningClient } from '@jackallabs/jackal.js-protos'
import {
  IClientHandler,
  INotificationRecord,
  ISharedUpdater,
  IShareFolderMetaHandler,
  IShareMetaHandler,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSharedRootMetaDataMap } from '@/types'

export class SharedUpdater extends EncodingHandler implements ISharedUpdater {
  protected readonly keyPair: PrivateKey
  protected readonly shared: TSharedRootMetaDataMap

  protected readonly notifications: INotificationRecord[]
  protected readonly existingPaths: Record<string, IShareFolderMetaHandler>
  protected readonly addedSharer: Record<string, IShareFolderMetaHandler>
  protected readonly addedMiddle: Record<string, IShareFolderMetaHandler>
  protected readonly addedShared: Record<string, IShareMetaHandler>

  constructor (
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
    shared: TSharedRootMetaDataMap,
  ) {
    super(client, jackalSigner, hostSigner, keyPair, client.getJackalAddress())
    this.keyPair = keyPair
    this.shared = shared

    this.notifications = []
    this.existingPaths = {}
    this.addedSharer = {}
    this.addedMiddle = {}
    this.addedShared = {}
  }

  /**
   * Fetch notifications from chain.
   * @returns {Promise<number>} - Number of new notifications found.
   */
  async fetchNotifications (): Promise<number> {
    try {
      const raw =
        await this.jackalSigner.queries.notifications.allNotificationsByAddress(
          { to: this.jklAddress },
        )
      for (let one of raw.notifications) {
        const rec = await this.reader.readShareNotification(one)
        this.notifications.push(rec)
      }
      return this.notifications.length
    } catch (err) {
      throw warnError('SharedUpdater fetchNotifications()', err)
    }
  }

  /**
   * Core process of sharing system.
   * @returns {Promise<void>}
   */
  async digest (): Promise<void> {
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
              this.existingPaths[parentName].addAndReturnCount(1)
            } else {
              this.existingPaths[parentName] =
                await ShareFolderMetaHandler.create({
                  count: size + 1,
                  location: '',
                  name: '',
                })
            }

            const fresh = this.makeFreshFolders(one.sender, chunked, depth)
            for (let path of fresh) {
              if (path in this.addedMiddle) {
                this.addedMiddle[path].addAndReturnCount(1)
              } else {
                this.addedMiddle[path] = await ShareFolderMetaHandler.create({
                  count: 1,
                  location: '',
                  name: '',
                  refIndex: this.findRefIndex(path),
                })
              }
            }
            finalName = ['s', sharedPath, one.sender, ...chunked, name].join(
              '/',
            )
          } else {
            finalName = ['s', sharedPath, one.sender, name].join('/')
          }
          this.addedShared[finalName] = await ShareMetaHandler.create({
            label: '',
            location: '',
            pointsTo: msgTrimmed,
            owner: one.sender,
            refIndex: this.findRefIndex(finalName),
          })
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

  /**
   * Check if sharer exists and create if not found.
   * @param {string} sender - Sharer to look for.
   * @returns {Promise<void>}
   * @protected
   */
  protected async maybeMakeSharer (sender: string): Promise<void> {
    const path = `s/${sharedPath}/${sender}`
    if (path in this.existingPaths) {
      this.existingPaths[path].addAndReturnCount(1)
    } else {
      if (sender in this.shared) {
        this.existingPaths[path] = await ShareFolderMetaHandler.create({
          count: Object.keys(this.shared[sender]).length + 1,
          location: '',
          name: '',
        })
      } else {
        this.addedSharer[path] = await ShareFolderMetaHandler.create({
          count: 1,
          location: '',
          name: '',
          refIndex: Object.keys(this.shared).length,
        })
        this.shared[sender] = {}
      }
    }
  }

  /**
   * Make a new folder for sharing.
   * @param {string} sender - Sender of share.
   * @param {string[]} base - Base path.
   * @param {number} offset - Starting offset for ref.
   * @returns {string[]} - Path of new folder.
   * @protected
   */
  protected makeFreshFolders (
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

  /**
   * Select ref from 3 options.
   * @param {string} path - Path to ref.
   * @returns {number} - Index of ref.
   * @protected
   */
  protected findRefIndex (path: string): number {
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

  /**
   * Create and fill message queue.
   * @returns {Promise<IWrappedEncodeObject[]>}
   * @protected
   */
  protected async buildMsgQueue (): Promise<IWrappedEncodeObject[]> {
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
        const sharedMeta = await ShareFolderMetaHandler.create({
          count: Object.keys(this.shared).length,
          location: '',
          name: `s/${sharedPath}`,
        })
        for (let name in this.addedSharer) {
          this.addedSharer[name].setRefIndex(sharedMeta.getCount())
          sharedMeta.addAndReturnCount(1)
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
