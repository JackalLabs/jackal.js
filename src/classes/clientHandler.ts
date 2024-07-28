import {
  connectHostQueryClient,
  connectHostSigningClient,
  connectJackalQueryClient,
  connectJackalSigningClient,
  IIbcEngageBundle,
  ITxLibrary, THostQueryClient, THostSigningClient,
  TJackalQueryClient,
  TJackalSigningClient,
  TMergedSigner,
  TQueryExtensions,
  TxEvent,
} from '@jackallabs/jackal.js-protos'
import {
  jackalTestnetChainConfig,
  jackalTestnetChainId,
  jackalTestnetRpc,
} from '@/utils/globalDefaults'
import {
  makeConnectionBundles,
  setDelay,
  signerNotEnabled,
  warnError,
} from '@/utils/misc'
import {
  MnemonicWallet,
  OracleHandler,
  RnsHandler,
  StorageHandler,
  WasmHandler,
} from '@/classes'
import { finalizeGas } from '@/utils/gas'
import type {
  IAvailableWallets,
  IBroadcastOptions,
  IBroadcastResults,
  IClientHandler,
  IClientSetup,
  IOracleHandler,
  IRnsHandler,
  IStorageHandler, IWasmHandler,
  IWrappedEncodeObject,
} from '@/interfaces'
import type { TSockets } from '@/types'

export class ClientHandler implements IClientHandler {
  protected readonly jklQuery: TJackalQueryClient
  protected readonly hostQuery: THostQueryClient
  protected readonly jklSigner: TJackalSigningClient | null
  protected readonly hostSigner: THostSigningClient | null
  protected readonly jklAddress: string
  protected readonly hostAddress: string
  protected readonly jklChainId: string
  protected readonly hostChainId: string
  protected readonly proofWindow: number
  protected readonly selectedWallet: string
  protected readonly isLedger: boolean
  protected readonly networks: TSockets[]

  protected myCosmwasm: IWasmHandler | null
  protected myContractAddress: string | null
  protected myIcaAddress: string | null

  protected constructor(
    jklQuery: TJackalQueryClient,
    hostQuery: THostQueryClient,
    jklSigner: TJackalSigningClient | null,
    hostSigner: THostSigningClient | null,
    jklAddress: string,
    hostAddress: string,
    jklChainId: string,
    hostChainId: string,
    proofWindow: number,
    selectedWallet: string,
    isLedger: boolean,
    networks: TSockets[]
  ) {
    this.jklQuery = jklQuery
    this.hostQuery = hostQuery
    this.jklSigner = jklSigner
    this.hostSigner = hostSigner
    this.jklAddress = jklAddress
    this.hostAddress = hostAddress
    this.jklChainId = jklChainId
    this.hostChainId = hostChainId
    this.proofWindow = proofWindow
    this.selectedWallet = selectedWallet
    this.isLedger = isLedger
    this.networks = networks

    this.myCosmwasm = null
    this.myContractAddress = null
    this.myIcaAddress = jklAddress
  }

  /**
   *
   * @param {IClientSetup} [setup]
   * @returns {Promise<IClientHandler>}
   */
  static async connect(setup: IClientSetup = {}): Promise<IClientHandler> {
    try {
      const {
        host,
        endpoint = jackalTestnetRpc,
        chainConfig = jackalTestnetChainConfig,
        chainId = jackalTestnetChainId,
        mnemonic = '' /* options = {}, */,
        selectedWallet = 'leap',
        networks = ['jackal']
      } = setup
      const jklQuery = connectJackalQueryClient(endpoint, {})
      const hostQuery = (!host) ? jklQuery : connectHostQueryClient(host.endpoint, {})
      let jklSigner: TJackalSigningClient | null = null
      let hostSigner: THostSigningClient | null = null
      let jklAddress = ''
      let hostAddress = ''
      let proofWindow: number = 7200
      let isLedger = false

      switch (selectedWallet) {
        case 'keplr':
          if (!window.keplr) {
            throw new Error('Keplr Wallet selected but unavailable')
          } else {
            await window.keplr.experimentalSuggestChain(chainConfig)
            await window.keplr.enable([chainId])
            const signer = (await window.keplr.getOfflineSignerAuto(
              chainId,
            )) as TMergedSigner
            jklSigner = await connectJackalSigningClient(
              endpoint,
              signer,
              {},
            )
            jklAddress = (await signer.getAccounts())[0].address
            const details = await window.keplr.getKey(chainId)
            isLedger = details.isNanoLedger

            if (host) {
              await window.keplr.experimentalSuggestChain(host.chainConfig)
              await window.keplr.enable([host.chainId])
              const tmpSigner = (await window.keplr.getOfflineSignerAuto(
                host.chainId,
              )) as TMergedSigner
              hostSigner = await connectHostSigningClient(
                host.endpoint,
                tmpSigner,
                {},
              )
              hostAddress = (await tmpSigner.getAccounts())[0].address
            } else {
              hostSigner = jklSigner
              hostAddress = jklAddress
            }
          }
          break
        case 'leap':
          if (!window.leap) {
            throw new Error('Leap Wallet selected but unavailable')
          } else {
            await window.leap.experimentalSuggestChain(chainConfig)
            await window.leap.enable([chainId])
            const signer = (await window.leap.getOfflineSignerAuto(
              chainId,
              {},
            )) as TMergedSigner
            if ('signAmino' in signer) {
              jklSigner = await connectJackalSigningClient(
                endpoint,
                signer,
                {},
              )
              jklAddress = (await signer.getAccounts())[0].address
              const details = await window.leap.getKey(chainId)
              isLedger = details.isNanoLedger

              if (host) {
                await window.leap.experimentalSuggestChain(host.chainConfig)
                await window.leap.enable([host.chainId])
                const tmpSigner = (await window.leap.getOfflineSignerAuto(
                  host.chainId,
                  {},
                )) as TMergedSigner
                if ('signAmino' in tmpSigner) {
                  hostSigner = await connectHostSigningClient(
                    host.endpoint,
                    tmpSigner,
                    {},
                  )
                  hostAddress = (await tmpSigner.getAccounts())[0].address
                } else {
                  hostSigner = jklSigner
                  hostAddress = jklAddress
                }
              }
            } else {
              throw new Error('Leap Wallet amino failure')
            }
          }
          break
        case 'mnemonic':
          if (!mnemonic) {
            throw new Error(
              'Mnemonic Wallet selected but mnemonic not provided',
            )
          } else {
            const wallet = await MnemonicWallet.init(mnemonic)
            const signer = wallet.getOfflineSigner()
            jklSigner = await connectJackalSigningClient(
              endpoint,
              signer,
              {},
            )
            jklAddress = wallet.getAddress()
            hostSigner = jklSigner
            hostAddress = jklAddress
          }
          break
        default:
          console.warn(
            'No wallet provider selected. Continuing in query-only mode.',
          )
      }

      if (jklSigner) {
        proofWindow = (await jklSigner.queries.storage.params()).params
          .proofWindow
      }

      return new ClientHandler(
        await jklQuery,
        await hostQuery,
        jklSigner,
        hostSigner,
        jklAddress,
        hostAddress,
        chainId,
        host?.chainId || chainId,
        proofWindow,
        selectedWallet,
        isLedger,
        networks
      )
    } catch (err) {
      throw warnError('ClientHandler connect()', err)
    }
  }

  /**
   * Detects wallet extensions installed by current browser. Supports Keplr and Leap.
   * @returns {IAvailableWallets} - Object containing boolean status of supported wallet extensions.
   */
  static detectAvailableWallets(): IAvailableWallets {
    return {
      keplr: !!window.keplr,
      leap: !!window.leap,
    }
  }

  /**
   *
   * @returns {Promise<IStorageHandler>}
   */
  async createStorageHandler(): Promise<IStorageHandler> {
    try {
      return await StorageHandler.init(this)
    } catch (err) {
      throw warnError('ClientHandler createStorageHandler()', err)
    }
  }

  /**
   *
   * @returns {Promise<IWasmHandler>}
   */
  async createWasmStorageHandler(): Promise<IStorageHandler> {
    try {
      this.myCosmwasm = await WasmHandler.init(this)
      this.myContractAddress = await this.myCosmwasm.getICAContractAddress()
      if (!this.myContractAddress) {
        await this.myCosmwasm.instantiateICA()
        this.myContractAddress = await this.myCosmwasm.getICAContractAddress()
      }
      this.myIcaAddress = await this.myCosmwasm.getJackalAddressFromContract(this.myContractAddress)
      return await StorageHandler.init(this, { accountAddress: this.myIcaAddress })
    } catch (err) {
      console.warn(err)
      throw warnError('ClientHandler createWasmStorageHandler()', err)
    }
  }

  /**
   *
   * @returns {Promise<IRnsHandler>}
   */
  async createRnsHandler(): Promise<IRnsHandler> {
    try {
      return await RnsHandler.init(this)
    } catch (err) {
      throw warnError('ClientHandler createRnsHandler()', err)
    }
  }

  /**
   *
   * @returns {Promise<IOracleHandler>}
   */
  async createOracleHandler(): Promise<IOracleHandler> {
    try {
      return await OracleHandler.init(this)
    } catch (err) {
      throw warnError('ClientHandler createOracleHandler()', err)
    }
  }

  /**
   *
   * @returns {string}
   */
  getChainId(): string {
    return this.jklChainId
  }

  /**
   *
   * @returns {string}
   */
  getHostChainId(): string {
    return this.hostChainId
  }

  /**
   *
   * @returns {boolean}
   */
  getIsLedger(): boolean {
    return this.isLedger
  }

  /**
   *
   * @returns {string}
   */
  getSelectedWallet(): string {
    return this.selectedWallet
  }

  /**
   *
   * @returns {number}
   */
  getProofWindow(): number {
    return this.proofWindow
  }

  /**
   *
   * @returns {Promise<number>}
   * @protected
   */
  async getJackalBlockHeight(): Promise<number> {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalBlockHeight'))
    }
    return await this.jklSigner.getHeight()
  }

  /**
   *
   * @returns {TJackalSigningClient}
   */
  getJackalSigner(): TJackalSigningClient | null {
    return this.jklSigner
  }

  /**
   *
   * @returns {TJackalSigningClient}
   */
  getHostSigner(): THostSigningClient | null {
    return this.hostSigner
  }

  /**
   *
   * @returns {TQueryExtensions}
   */
  getQueries(): TQueryExtensions {
    return this.jklQuery.queries as TQueryExtensions
  }

  /**
   *
   * @returns {ITxLibrary}
   */
  getTxs(): ITxLibrary {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getTxs'))
    }
    return this.jklSigner.txLibrary as unknown as ITxLibrary
  }

  /**
   * Expose signing ClientHandler instance jkl address.
   * @returns {string} - Jkl address.
   */
  getJackalAddress(): string {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalAddress'))
    }
    return this.jklAddress
  }

  /**
   * Expose signing ClientHandler instance host wallet address.
   * @returns {string} - Host address.
   */
  getHostAddress(): string {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getHostAddress'))
    }
    return this.hostAddress
  }

  /**
   * Expose WASM ICA Contract instance jkl address.
   * @returns {string} - Jkl address.
   */
  getICAJackalAddress(): string {
    if (!this.myIcaAddress) {
      throw new Error(signerNotEnabled('ClientHandler', 'getICAJackalAddress'))
    }
    return this.myIcaAddress
  }

  /**
   * Retrieve asymmetric keypair public key from chain for specified jkl address.
   * @param {string} address - Jkl address to check.
   * @returns {Promise<string>} - Target address' public key as hex value.
   */
  async findPubKey(address: string): Promise<string> {
    try {
      const result = await this.jklQuery.queries.fileTree.pubKey({ address })
      return result.pubKey.key
    } catch (err) {
      throw warnError('clientHandler findPubKey()', err)
    }
  }

  async myPubKeyIsPublished(): Promise<boolean> {
    try {
      const key = await this.findPubKey(this.myIcaAddress || this.hostAddress)
      return key.length > 0
    } catch (err) {
      throw warnError('clientHandler pubKeyIsPublished()', err)
    }
  }

  /**
   *
   * @param {IWrappedEncodeObject | IWrappedEncodeObject[]} wrappedMsgs
   * @param {IBroadcastOptions} [options]
   * @returns {Promise<IBroadcastResults>}
   */
  async broadcastAndMonitorMsgs(
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
    options: IBroadcastOptions = {},
  ): Promise<IBroadcastResults> {
    if (!this.hostSigner || !this.jklSigner) {
      throw new Error(
        signerNotEnabled('ClientHandler', 'broadcastAndMonitorMsgs'),
      )
    }
    try {
      let chosenSigner: THostSigningClient | TJackalSigningClient = this.jklSigner

      const {
        gasOverride,
        memo,
        broadcastTimeoutHeight,
        monitorTimeout = 30
      } = options
      const events: TxEvent[] = []
      const ready: IWrappedEncodeObject[] =
        wrappedMsgs instanceof Array ? [...wrappedMsgs] : [wrappedMsgs]
      let { fee, msgs } = finalizeGas(ready, gasOverride)

      const connectionBundles: IIbcEngageBundle<TxEvent>[] = makeConnectionBundles(this.networks, events, msgs, this.myIcaAddress || this.hostAddress)
      console.log('connectionBundles:', connectionBundles)

      if (this.myContractAddress && this.myCosmwasm) {
        chosenSigner = this.hostSigner
        msgs = this.myCosmwasm.wrapEncodeObjectsForBroadcast(this.myContractAddress, msgs)
      }
      chosenSigner.monitor(connectionBundles)
      const broadcastResult = chosenSigner.selfSignAndBroadcast(msgs, {
        fee,
        memo,
        timeoutHeight: broadcastTimeoutHeight
      })

      return new Promise((resolve, reject) => {
        (async () => {
          let eventsAreFinished = false
          let rejected = false
          const broadcastTimeout = setTimeout(async () => {
            rejected = true
            reject({
              error: true,
              errorText: 'Event Timeout',
              txResponse: await broadcastResult,
              txEvents: events,
            })
          }, monitorTimeout * 1000)

          while (!eventsAreFinished && !rejected) {
            // console.log('waiting')
            await setDelay(0.5)
            eventsAreFinished = events.length >= 1
          }
          if (eventsAreFinished) {
            clearTimeout(broadcastTimeout)
            // console.log('resolving')
            resolve({
              error: false,
              errorText: '',
              txResponse: await broadcastResult,
              txEvents: events,
            })
          }
        })()
      })
    } catch (err) {
      throw warnError('clientHandler broadcastAndMonitorMsgs()', err)
    }
  }
}
