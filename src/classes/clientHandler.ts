import {
  connectHostQueryClient,
  connectHostSigningClient,
  connectJackalQueryClient,
  connectJackalSigningClient,
  DCoin,
  IIbcEngageBundle,
  ITxLibrary,
  THostQueryClient,
  THostSigningClient,
  TJackalQueryClient,
  TJackalSigningClient,
  TMergedSigner,
  TQueryExtensions,
  TxEvent,
} from '@jackallabs/jackal.js-protos'
import { jackalTestnetChainConfig, jackalTestnetChainId, jackalTestnetRpc, sockets } from '@/utils/globalDefaults'
import { makeConnectionBundles, setDelay, signerNotEnabled, warnError } from '@/utils/misc'
import { MnemonicWallet, OracleHandler, RnsHandler, StorageHandler, WasmHandler } from '@/classes'
import { finalizeGas } from '@/utils/gas'
import {
  IAvailableWallets,
  IBroadcastOptions,
  IBroadcastResults,
  IClientHandler,
  IClientSetup,
  IOracleHandler,
  IRnsHandler,
  IStorageHandler,
  IWalletDetails,
  IWasmDetails,
  IWasmHandler,
  IWrappedEncodeObject,
} from '@/interfaces'
import { TSockets, TSocketSet } from '@/types'
import { DeliverTxResponse, StdFee } from '@cosmjs/stargate'

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
  protected readonly details: IWalletDetails
  protected readonly networks: TSockets[]
  protected readonly gasMultiplier: number

  protected myCosmwasm: IWasmHandler | null
  protected myContractAddress: string | null
  protected myIcaAddress: string | null

  protected constructor (
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
    details: IWalletDetails,
    networks: TSockets[],
    gasMultiplier: number,
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
    this.details = details
    this.networks = networks
    this.gasMultiplier = gasMultiplier

    this.myCosmwasm = null
    this.myContractAddress = null
    this.myIcaAddress = null
  }

  /**
   *
   * @param {IClientSetup} [setup]
   * @returns {Promise<IClientHandler>}
   */
  static async connect (setup: IClientSetup = {}): Promise<IClientHandler> {
    try {
      const {
        host,
        endpoint = jackalTestnetRpc,
        chainConfig = jackalTestnetChainConfig,
        chainId = jackalTestnetChainId,
        mnemonic = '' /* options = {}, */,
        selectedWallet = 'leap',
        networks = ['jackal'],
        gasMultiplier,
      } = setup
      const jklQuery = connectJackalQueryClient(endpoint, {})
      const hostQuery = !host
        ? jklQuery
        : connectHostQueryClient(host.endpoint, {})
      let jklSigner: TJackalSigningClient | null = null
      let hostSigner: THostSigningClient | null = null
      let jklAddress = ''
      let hostAddress = ''
      let proofWindow: number = 7200
      let details: IWalletDetails = {
        name: '',
        algo: '',
        pubKey: new Uint8Array(),
        address: new Uint8Array(),
        bech32Address: '',
        isNanoLedger: false,
      }

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
            jklSigner = await connectJackalSigningClient(endpoint, signer, {})
            jklAddress = (await signer.getAccounts())[0].address
            details = await window.keplr.getKey(chainId)

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
              jklSigner = await connectJackalSigningClient(endpoint, signer, {})
              jklAddress = (await signer.getAccounts())[0].address
              details = await window.leap.getKey(chainId)

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
                  throw new Error('Leap Wallet amino failure')
                }
              } else {
                hostSigner = jklSigner
                hostAddress = jklAddress
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
            jklSigner = await connectJackalSigningClient(endpoint, signer, {})
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

      let myGasMultiplier = 0
      if (networks.includes('jackal')) {
        if (networks.length === 1) {
          myGasMultiplier = sockets['jackal'].gasMultiplier
        } else {
          const subset = networks.filter((value) => value !== 'jackal')
          myGasMultiplier = sockets[subset[0]].gasMultiplier
        }
      } else {
        myGasMultiplier = sockets[networks[0]].gasMultiplier
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
        details,
        networks,
        gasMultiplier || myGasMultiplier,
      )
    } catch (err) {
      throw warnError('clientHandler connect()', err)
    }
  }

  /**
   * Detects wallet extensions installed by current browser. Supports Keplr and Leap.
   * @returns {IAvailableWallets} - Object containing boolean status of supported wallet extensions.
   */
  static detectAvailableWallets (): IAvailableWallets {
    return {
      keplr: !!window.keplr,
      leap: !!window.leap,
    }
  }

  /**
   *
   * @returns {Promise<IStorageHandler>}
   */
  async createStorageHandler (): Promise<IStorageHandler> {
    try {
      return await StorageHandler.init(this)
    } catch (err) {
      throw warnError('clientHandler createStorageHandler()', err)
    }
  }

  /**
   * Create Wasm Handler session, defaults to Archway.
   * @param {IWasmDetails} [details]
   * @returns {Promise<IStorageHandler>}
   */
  async createWasmStorageHandler (details: IWasmDetails = {}): Promise<IStorageHandler> {
    try {
      const {
        connIdA = 'connection-18',
        connIdB = 'connection-50',
        contract = 'archway1meqkgwa8nef3d49wuleu2m092q4mtkespal39vd280yy6nj5lhhqllu4kn',
      } = details
      this.myCosmwasm = await WasmHandler.init(this)
      const ica = await this.myCosmwasm.getICAContractAddress(contract).catch(err => {
        console.warn('can\'t get ica', err)
      })
      console.log('ICA: ', ica)
      if (ica) {
        console.log('Set ICA correctly')
        this.myContractAddress = ica
      } else {
        console.log('Failed to set ICA')
        await this.myCosmwasm.instantiateICA(
          contract,
          connIdA,
          connIdB,
        )
        await new Promise(r => setTimeout(r, 5000))
        this.myContractAddress = await this.myCosmwasm.getICAContractAddress(contract)
      }
      console.log(this.myContractAddress)
      this.myIcaAddress = await this.myCosmwasm.getJackalAddressFromContract(
        this.myContractAddress,
      )
      const state = await this.myCosmwasm.getContractChannelState(
        this.myContractAddress,
      )
      console.log('State: ', state)
      if (state === 'STATE_CLOSED') {
        console.log('needs to re-open channel')
        await this.myCosmwasm.reOpenChannel(
          contract,
          connIdA,
          connIdB,
        )
      }

      return await StorageHandler.init(this, {
        accountAddress: this.myIcaAddress,
      })
    } catch (err) {
      console.warn(err)
      throw warnError('clientHandler createArchwayStorageHandler()', err)
    }
  }

  /**
   *
   * @returns {Promise<IRnsHandler>}
   */
  async createRnsHandler (): Promise<IRnsHandler> {
    try {
      return await RnsHandler.init(this)
    } catch (err) {
      throw warnError('clientHandler createRnsHandler()', err)
    }
  }

  /**
   *
   * @returns {Promise<IOracleHandler>}
   */
  async createOracleHandler (): Promise<IOracleHandler> {
    try {
      return await OracleHandler.init(this)
    } catch (err) {
      throw warnError('clientHandler createOracleHandler()', err)
    }
  }

  /**
   *
   * @returns {string}
   */
  getChainId (): string {
    return this.jklChainId
  }

  /**
   *
   * @returns {string}
   */
  getHostChainId (): string {
    return this.hostChainId
  }

  /**
   *
   * @returns {boolean}
   */
  getIsLedger (): boolean {
    return this.details.isNanoLedger
  }

  /**
   *
   * @returns {IWalletDetails}
   */
  getWalletDetails (): IWalletDetails {
    return this.details
  }

  /**
   *
   * @returns {string}
   */
  getSelectedWallet (): string {
    return this.selectedWallet
  }

  /**
   *
   * @returns {number}
   */
  getProofWindow (): number {
    return this.proofWindow
  }

  /**
   *
   * @returns {Promise<number>}
   * @protected
   */
  async getJackalBlockHeight (): Promise<number> {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalBlockHeight'))
    }
    return await this.jklSigner.getHeight()
  }

  /**
   *
   * @returns {TJackalSigningClient}
   */
  getJackalSigner (): TJackalSigningClient | null {
    return this.jklSigner
  }

  /**
   *
   * @returns {TJackalSigningClient}
   */
  getHostSigner (): THostSigningClient | null {
    return this.hostSigner
  }

  /**
   *
   * @returns {TQueryExtensions}
   */
  getQueries (): TQueryExtensions {
    return this.jklQuery.queries as TQueryExtensions
  }

  /**
   *
   * @returns {ITxLibrary}
   */
  getTxs (): ITxLibrary {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getTxs'))
    }
    return this.jklSigner.txLibrary as unknown as ITxLibrary
  }

  /**
   *
   * @returns {Promise<DCoin>}
   */
  async getJklBalance (): Promise<DCoin> {
    return this.getJackalNetworkBalance(this.getICAJackalAddress())
  }

  /**
   *
   * @param {string} address
   * @param {DCoin} amount
   * @param {string} sourceChannel
   * @returns {Promise<DeliverTxResponse>}
   */
  async ibcSend (address: string, amount: DCoin, sourceChannel: string): Promise<DeliverTxResponse> {
    if (!this.hostSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'ibcSend'))
    }
    try {
      const fee: DCoin = { amount: '35774392000000000', denom: 'aarch' }
      const standardFee: StdFee = { amount: [fee], gas: '200000' }

      return await this.hostSigner.sendIbcTokens(this.hostAddress, address, amount, 'transfer', sourceChannel, undefined, Date.now() * 1000 * 1000 + 2 * 60 * 60 * 1000 * 1000 * 1000, standardFee, undefined)
    } catch (err) {
      throw warnError('clientHandler ibcSend()', err)
    }
  }

  /**
   *
   * @param {string} address
   * @returns {Promise<DCoin>}
   */
  async getJackalNetworkBalance (address: string): Promise<DCoin> {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalNetworkBalance'))
    }
    try {
      const res = await this.jklQuery.queries.bank.balance({
        address,
        denom: 'ujkl',
      })
      return res.balance as DCoin
    } catch (err) {
      throw warnError('clientHandler getJackalNetworkBalance()', err)
    }
  }

  /**
   *
   * @param {string} address
   * @param {string} denom
   * @returns {Promise<DCoin>}
   */
  async getHostNetworkBalance (address: string, denom: string): Promise<DCoin> {
    if (!this.hostQuery) {
      throw new Error(signerNotEnabled('ClientHandler', 'getHostNetworkBalance'))
    }
    try {
      return await this.hostQuery.getBalance(address, denom)
    } catch (err) {
      throw warnError('clientHandler getHostNetworkBalance()', err)
    }
  }

  /**
   * Expose signing ClientHandler instance jkl address.
   * @returns {string} - Jkl address.
   */
  getJackalAddress (): string {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalAddress'))
    }
    return this.jklAddress
  }

  /**
   * Expose signing ClientHandler instance host wallet address.
   * @returns {string} - Host address.
   */
  getHostAddress (): string {
    if (!this.jklSigner) {
      throw new Error(signerNotEnabled('ClientHandler', 'getHostAddress'))
    }
    return this.hostAddress
  }

  /**
   * Expose WASM ICA Contract instance jkl address.
   * @returns {string} - Jkl address.
   */
  getICAJackalAddress (): string {
    if (!this.myIcaAddress) {
      return this.jklAddress
    }
    return this.myIcaAddress
  }

  /**
   * Returns true if ICA address has been set by wasm signer.
   * @returns {boolean}
   */
  wasmIsConnected (): boolean {
    return this.getICAJackalAddress() !== this.jklAddress
  }

  /**
   * Retrieve asymmetric keypair public key from chain for specified jkl address.
   * @param {string} address - Jkl address to check.
   * @returns {Promise<string>} - Target address' public key as hex value.
   */
  async findPubKey (address: string): Promise<string> {
    try {
      const result = await this.jklQuery.queries.fileTree.pubKey({ address })
      return result.pubKey.key
    } catch (err) {
      throw warnError('clientHandler findPubKey()', err)
    }
  }

  /**
   *
   * @returns {Promise<boolean>}
   */
  async myPubKeyIsPublished (): Promise<boolean> {
    try {
      const key = await this.findPubKey(this.getICAJackalAddress())
      return key.length > 0
    } catch (err) {
      throw warnError('clientHandler myPubKeyIsPublished()', err)
    }
  }

  /**
   *
   * @param {IWrappedEncodeObject | IWrappedEncodeObject[]} wrappedMsgs
   * @param {IBroadcastOptions} [options]
   * @returns {Promise<IBroadcastResults>}
   */
  async broadcastAndMonitorMsgs (
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
    options: IBroadcastOptions = {},
  ): Promise<IBroadcastResults> {
    if (!this.hostSigner || !this.jklSigner) {
      throw new Error(
        signerNotEnabled('ClientHandler', 'broadcastAndMonitorMsgs'),
      )
    }
    try {
      let chosenSigner: THostSigningClient | TJackalSigningClient =
        this.jklSigner
      if (this.networks.length > 1) {
        chosenSigner = this.hostSigner
        console.log('Switching to ' + this.hostAddress)
      }

      const {
        gasOverride,
        memo,
        broadcastTimeoutHeight,
        monitorTimeout = 30,
        socketOverrides = {} as TSocketSet,
        queryOverride,
      } = options
      const events: TxEvent[] = []
      const ready: IWrappedEncodeObject[] =
        wrappedMsgs instanceof Array ? [...wrappedMsgs] : [wrappedMsgs]
      let { fee, msgs } = finalizeGas(ready, this.gasMultiplier, gasOverride)

      const connectionBundles: IIbcEngageBundle<TxEvent>[] =
        makeConnectionBundles(
          this.networks,
          events,
          msgs,
          this.myIcaAddress || this.hostAddress,
          socketOverrides,
          queryOverride,
        )
      console.log('connectionBundles:', connectionBundles)

      if (this.myContractAddress && this.myCosmwasm) {
        chosenSigner = this.hostSigner
        msgs = this.myCosmwasm.wrapEncodeObjectsForBroadcast(
          this.myContractAddress,
          msgs,
        )
      }
      chosenSigner.monitor(connectionBundles)
      const broadcastResult = chosenSigner.selfSignAndBroadcast(msgs, {
        fee,
        memo,
        timeoutHeight: broadcastTimeoutHeight,
      })

      return new Promise((resolve, reject) => {
        ;(async () => {
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
