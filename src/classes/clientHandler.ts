import {
  JackalSigningStargateClient,
  JackalStargateClient,
} from '@jackallabs/jackal.js-protos'
import { PrivateKey } from 'eciesjs'
import {
  jackalTestnetChainConfig,
  jackalTestnetChainId,
  jackalTestnetRpc,
  signatureSeed,
} from '@/utils/globalDefaults'
import { bufferToHex } from '@/utils/hash'
import { signerNotEnabled, warnError } from '@/utils/misc'
import { stringToUint8Array } from '@/utils/converters'
import { MnemonicWallet } from '@/classes/mnemonicWallet'
import { finalizeGas } from '@/utils/gas'
import { StorageHandler } from '@/classes/storageHandler'
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
} from '@/interfaces'

export class ClientHandler implements IClientHandler {
  protected readonly queryClient: IJackalStargateClient
  protected readonly signingClient: IJackalSigningStargateClient | null
  protected readonly address: string
  protected readonly proofWindow: number
  protected readonly keyPair: PrivateKey | null

  protected constructor(
    queryClient: IJackalStargateClient,
    signingClient: IJackalSigningStargateClient | null,
    address: string,
    proofWindow: number,
    keyPair: PrivateKey | null,
  ) {
    this.queryClient = queryClient
    this.signingClient = signingClient
    this.address = address
    this.proofWindow = proofWindow
    this.keyPair = keyPair
  }

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
    let keyPair: PrivateKey | null = null
    let proofWindow: number = 0

    switch (selectedWallet) {
      case 'keplr':
        if (!window.keplr) {
          throw new Error('Keplr Wallet selected but unavailable')
        }
        await window.keplr.experimentalSuggestChain(chainConfig)
        await window.keplr.enable([chainId]).catch((err: Error) => {
          throw err
        })
        {
          // const signer = window.keplr.getOfflineSigner(chainId)
          const signer = (await window.keplr.getOfflineSignerAuto(
            chainId,
          )) as TSigner
          signingClient = await JackalSigningStargateClient.connectWithSigner(
            endpoint,
            signer,
          )
          address = (await signer.getAccounts())[0].address
          const { signature } = await window.keplr
            .signArbitrary(chainId, address, signatureSeed)
            .catch((err: Error) => {
              throw warnError('clientHandler connect() keplr', err)
            })
          const signatureAsHex = bufferToHex(
            stringToUint8Array(atob(signature)).slice(0, 32),
          )
          keyPair = PrivateKey.fromHex(signatureAsHex)
        }
        break
      case 'leap':
        if (!window.leap) {
          throw new Error('Leap Wallet selected but unavailable')
        }
        await window.leap.experimentalSuggestChain(chainConfig)
        await window.leap.enable([chainId]).catch((err: Error) => {
          throw err
        })
        {
          // const signer = window.leap.getOfflineSigner(chainId, {})
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
            const { signature } = await window.leap
              .signArbitrary(chainId, address, signatureSeed)
              .catch((err: Error) => {
                throw warnError('clientHandler connect() leap', err)
              })
            const signatureAsHex = bufferToHex(
              stringToUint8Array(atob(signature)).slice(0, 32),
            )
            keyPair = PrivateKey.fromHex(signatureAsHex)
          } else {
            throw new Error('Leap wallet amino failure')
          }
        }
        break
      case 'mnemonic':
        // throw new Error('Mnemonic Wallet is not yet implemented')
        if (!mnemonic) {
          throw new Error('Mnemonic Wallet selected but mnemonic not provided')
        }
        {
          const wallet = await MnemonicWallet.init(mnemonic)
          const signer = wallet.getOfflineSigner()
          address = wallet.getAddress()
          signingClient = await JackalSigningStargateClient.connectWithSigner(
            endpoint,
            signer,
          )
          const { signature } = await wallet
            .signArbitrary(signatureSeed)
            .catch((err: Error) => {
              throw warnError('clientHandler connect() mnemonic', err)
            })
          const signatureAsHex = bufferToHex(
            stringToUint8Array(atob(signature)).slice(0, 32),
          )
          keyPair = PrivateKey.fromHex(signatureAsHex)
        }
        break
      default:
        console.warn(
          'No wallet provider selected. Continuing in query-only mode.',
        )
    }

    if (signingClient) {
      proofWindow = (await signingClient.queries.storage.params({})).params
        .proofWindow
    }

    return new ClientHandler(
      queryClient,
      signingClient,
      address,
      proofWindow,
      keyPair,
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

  async createStorageHandler(): Promise<IStorageHandler> {
    return StorageHandler.init(
      this,
    )
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
  getSigningClient(): IJackalSigningStargateClient {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getSigningClient'))
    }
    return this.signingClient
  }

  getQueries(): TQueryExtensions {
    if (!this.signingClient) {
      throw new Error(signerNotEnabled('ClientHandler', 'getQueries'))
    }
    return this.signingClient.queries
  }

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
   * Expose signing ClientHandler instance public key as hex value.
   * @returns {string} - Public key as hex value.
   */
  getPubKey(): string {
    if (!this.keyPair) {
      throw new Error(signerNotEnabled('ClientHandler', 'getPubKey'))
    }
    return this.keyPair.publicKey.toHex()
  }

  /**
   * Expose signing ClientHandler instance private key as hex value.
   * @returns {string} - Private key as hex value.
   */
  getPrivateKey(): string {
    if (!this.keyPair) {
      throw new Error(signerNotEnabled('ClientHandler', 'getPrivateKey'))
    }
    return this.keyPair.toHex()
  }

  /**
   * Retrieve asymmetric keypair public key from chain for specified jkl address.
   * @param {string} address - Jkl address to check.
   * @returns {Promise<string>} - Target address' public key as hex value.
   */
  async findPubKey(address: string): Promise<string> {
    if (address === this.address) {
      return this.getPubKey()
    } else {
      const result = await this.queryClient.queries.fileTree
        .pubKey({ address })
        .catch((err: Error) => {
          throw warnError('clientHandler findPubKey()', err)
        })
      return result.pubKey.key
    }
  }

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
