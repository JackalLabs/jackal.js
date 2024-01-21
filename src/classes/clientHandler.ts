import {
  JackalSigningStargateClient,
  JackalStargateClient,
} from '@jackallabs/jackal.js-protos'
import {
  jackalTestnetChainConfig,
  jackalTestnetChainId,
  jackalTestnetRpc,
} from '@/utils/globalDefaults'
import { signerNotEnabled, warnError } from '@/utils/misc'
import {
  MnemonicWallet,
  StorageHandler,
  RnsHandler,
  OracleHandler,
} from '@/classes'
import { finalizeGas } from '@/utils/gas'
import type {
  DDeliverTxResponse,
  IJackalSigningStargateClient,
  IJackalStargateClient,
  ITxLibrary,
  TQueryExtensions,
  TSigner,
} from '@jackallabs/jackal.js-protos'
import type {
  IClientHandler,
  IClientSetup,
  IStorageHandler,
  IAvailableWallets,
  IWrappedEncodeObject,
  IRnsHandler,
  IOracleHandler,
} from '@/interfaces'

export class ClientHandler implements IClientHandler {
  protected readonly queryClient: IJackalStargateClient
  protected readonly signingClient: IJackalSigningStargateClient | null
  protected readonly address: string
  protected readonly proofWindow: number
  protected readonly chainId: string
  protected readonly selectedWallet: string
  protected readonly isLedger: boolean

  protected constructor(
    queryClient: IJackalStargateClient,
    signingClient: IJackalSigningStargateClient | null,
    address: string,
    proofWindow: number,
    chainId: string,
    selectedWallet: string,
    isLedger: boolean,
  ) {
    this.queryClient = queryClient
    this.signingClient = signingClient
    this.address = address
    this.proofWindow = proofWindow
    this.chainId = chainId
    this.selectedWallet = selectedWallet
    this.isLedger = isLedger
  }

  /**
   *
   * @param {IClientSetup} [setup]
   * @returns {Promise<IClientHandler>}
   */
  static async connect(setup: IClientSetup = {}): Promise<IClientHandler> {
    const {
      endpoint = jackalTestnetRpc,
      chainConfig = jackalTestnetChainConfig,
      chainId = jackalTestnetChainId,
      mnemonic = '' /* options = {}, */,
      selectedWallet = 'leap',
    } = setup
    const queryClient = await JackalStargateClient.connect(endpoint)
    let signingClient: JackalSigningStargateClient | null = null
    let address = ''
    let proofWindow: number = 0
    let isLedger = false

    switch (selectedWallet) {
      case 'keplr':
        if (!window.keplr) {
          throw new Error('Keplr Wallet selected but unavailable')
        } else {
          await window.keplr.experimentalSuggestChain(chainConfig)
          await window.keplr.enable([chainId]).catch((err: Error) => {
            throw err
          })
          const signer = (await window.keplr.getOfflineSignerAuto(
            chainId,
          )) as TSigner
          signingClient = await JackalSigningStargateClient.connectWithSigner(
            endpoint,
            signer,
          )
          address = (await signer.getAccounts())[0].address
          const details = await window.keplr.getKey(chainId)
          isLedger = details.isNanoLedger
        }
        break
      case 'leap':
        if (!window.leap) {
          throw new Error('Leap Wallet selected but unavailable')
        } else {
          await window.leap.experimentalSuggestChain(chainConfig)
          await window.leap.enable([chainId]).catch((err: Error) => {
            throw err
          })
          const signer = (await window.leap.getOfflineSignerAuto(
            chainId,
            {},
          )) as TSigner
          if ('signAmino' in signer) {
            signingClient = await JackalSigningStargateClient.connectWithSigner(
              endpoint,
              signer,
            )
            address = (await signer.getAccounts())[0].address
            const details = await window.leap.getKey(chainId)
            isLedger = details.isNanoLedger
          } else {
            throw new Error('Leap Wallet amino failure')
          }
        }
        break
      case 'mnemonic':
        if (!mnemonic) {
          throw new Error('Mnemonic Wallet selected but mnemonic not provided')
        } else {
          const wallet = await MnemonicWallet.init(mnemonic)
          const signer = wallet.getOfflineSigner()
          signingClient = await JackalSigningStargateClient.connectWithSigner(
            endpoint,
            signer,
          )
          address = wallet.getAddress()
        }
        break
      default:
        console.warn(
          'No wallet provider selected. Continuing in query-only mode.',
        )
    }

    if (signingClient) {
      proofWindow = (await signingClient.queries.storage.params()).params
        .proofWindow
    }

    return new ClientHandler(
      queryClient,
      signingClient,
      address,
      proofWindow,
      chainId,
      selectedWallet,
      isLedger,
    )
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
    return StorageHandler.init(this).catch((err: Error) => {
      throw warnError('ClientHandler createStorageHandler()', err)
    })
  }

  /**
   *
   * @returns {Promise<IRnsHandler>}
   */
  async createRnsHandler(): Promise<IRnsHandler> {
    return RnsHandler.init(this).catch((err: Error) => {
      throw warnError('ClientHandler createRnsHandler()', err)
    })
  }

  /**
   *
   * @returns {Promise<IOracleHandler>}
   */
  async createOracleHandler(): Promise<IOracleHandler> {
    return OracleHandler.init(this).catch((err: Error) => {
      throw warnError('ClientHandler createOracleHandler()', err)
    })
  }

  /**
   *
   * @returns {string}
   */
  getChainId(): string {
    return this.chainId
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
  async getLatestBlockHeight(): Promise<number> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getLatestBlockHeight'))
    }
    const tm = this.signingClient.baseTmClient()
    if (!tm) {
      throw new Error(
        warnError(
          'ClientHandler getLatestBlockHeight()',
          'Invalid baseTmClient()',
        ),
      )
    }
    const { lastBlockHeight } = await tm.abciInfo()
    if (!lastBlockHeight) {
      throw new Error(
        warnError(
          'ClientHandler getLatestBlockHeight()',
          'Invalid lastBlockHeight',
        ),
      )
    }
    return lastBlockHeight
  }

  /**
   *
   * @returns {IJackalSigningStargateClient}
   */
  getSigningClient(): IJackalSigningStargateClient | null {
    return this.signingClient
  }

  /**
   *
   * @returns {TQueryExtensions}
   */
  getQueries(): TQueryExtensions {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getQueries'))
    }
    return this.signingClient.queries
  }

  /**
   *
   * @returns {ITxLibrary}
   */
  getTxs(): ITxLibrary {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getTxs'))
    }
    return this.signingClient.txLibrary
  }

  /**
   * Expose signing ClientHandler instance jkl address.
   * @returns {string} - Jkl address.
   */
  getJackalAddress(): string {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getJackalAddress'))
    }
    return this.address
  }

  /**
   * Retrieve asymmetric keypair public key from chain for specified jkl address.
   * @param {string} address - Jkl address to check.
   * @returns {Promise<string>} - Target address' public key as hex value.
   */
  async findPubKey(address: string): Promise<string> {
    const result = await this.queryClient.queries.fileTree
      .pubKey({ address })
      .catch((err: Error) => {
        throw warnError('clientHandler findPubKey()', err)
      })
    return result.pubKey.key
  }

  /**
   *
   * @param {IWrappedEncodeObject | IWrappedEncodeObject[]} wrappedMsgs
   * @returns {Promise<DDeliverTxResponse>}
   */
  broadcastsMsgs(
    wrappedMsgs: IWrappedEncodeObject | IWrappedEncodeObject[],
  ): Promise<DDeliverTxResponse> {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'broadcastsMsgs'))
    }
    const ready: IWrappedEncodeObject[] = []
    if (wrappedMsgs instanceof Array) {
      ready.push(...wrappedMsgs)
    } else {
      ready.push(wrappedMsgs)
    }
    const fee = finalizeGas(ready)
    const strippedMsgs = ready.map((el) => el.encodedObject)
    return this.signingClient.selfSignAndBroadcast(strippedMsgs, { fee })
  }
}
