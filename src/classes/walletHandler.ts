import { AccountData, EncodeObject, isOfflineDirectSigner, OfflineSigner } from '@cosmjs/proto-signing'
import { decrypt, encrypt, PrivateKey } from 'eciesjs'
import { Keplr, Window as KeplrWindow } from '@keplr-wallet/types'
import { Leap, LeapWindow } from '@/types/leap'
import { defaultQueryAddr9091, defaultTxAddr26657, jackalMainnetChainId } from '@/utils/globals'
import {
  IAbciHandler,
  IFileIo,
  IGovHandler,
  INotificationHandler,
  IOracleHandler,
  IProtoHandler,
  IQueryHandler,
  IRnsHandler,
  ISecretsHandler,
  IStorageHandler,
  IWalletHandler
} from '@/interfaces/classes'
import { bufferToHex, hashAndHex, hexFullPath, merkleMeBro } from '@/utils/hash'
import {
  IAdditionalWalletOptions,
  ICoin,
  /** TODO */
  // IEnabledSecrets,
  ISupportedWallets,
  IWalletConfig,
  IWalletHandlerPrivateProperties,
  IWalletHandlerPublicProperties
} from '@/interfaces'
import ProtoHandler from '@/classes/protoHandler'
import { Pubkey } from 'jackal.js-protos'
import {
  AbciHandler,
  FileIo,
  GovHandler,
  NotificationHandler,
  OracleHandler,
  RnsHandler,
  SecretsHandler,
  StorageHandler
} from '@/index'
import QueryHandler from '@/classes/queryHandler'
import { signerNotEnabled } from '@/utils/misc'

declare global {
  interface Window extends KeplrWindow, LeapWindow {}
}

const defaultChains = [jackalMainnetChainId, 'osmo-1', 'cosmoshub-4']

export default class WalletHandler implements IWalletHandler {
  private readonly qH: IQueryHandler
  private properties: IWalletHandlerPrivateProperties | null
  traits: IWalletHandlerPublicProperties | null

  private constructor(
    qH: IQueryHandler,
    properties: IWalletHandlerPrivateProperties | null,
    traits: IWalletHandlerPublicProperties | null
  ) {
    this.qH = qH
    this.properties = properties
    this.traits = traits
  }

  static async trackWallet(config: IWalletConfig, options?: IAdditionalWalletOptions): Promise<IWalletHandler> {
    if (!window) {
      throw new Error(
        'Jackal.js is only supported in the browser at this time!'
      )
    } else {
      const qH = await QueryHandler.trackQuery(config.queryAddr)
      const { properties, traits } = await processWallet(config, options)
        .catch(err => {
          throw err
        })

      return new WalletHandler(
        qH,
        properties,
        traits
      )
    }
  }
  static async trackQueryWallet(queryUrl?: string): Promise<IWalletHandler> {
    if (!window) {
      throw new Error(
        'Jackal.js is only supported in the browser at this time!'
      )
    } else {
      const qH = await QueryHandler.trackQuery(queryUrl)
      return new WalletHandler(
        qH,
        null,
        null
      )
    }
  }
  static async getAbitraryMerkle(path: string, item: string): Promise<string> {
    return await hexFullPath(await merkleMeBro(path), item)
  }
  static async initAccount(
    wallet: IWalletHandler,
    filetreeTxClient: any
  ): Promise<EncodeObject> {
    const { msgInitAll } = await filetreeTxClient
    const initCall = msgInitAll({
      creator: wallet.getJackalAddress(),
      pubkey: wallet.getPubkey()
    })
    return initCall
  }
  static detectAvailableWallets(): ISupportedWallets {
    return {
      keplr: !!window.keplr,
      leap: !!window.leap
    }
  }

  async convertToFullWallet (config: IWalletConfig, options?: IAdditionalWalletOptions): Promise<void> {
    const { properties, traits } = await processWallet(config, options)
      .catch(err => {
        throw err
      })
    this.properties = properties
    this.traits = traits
  }
  voidFullWallet (): void {
    this.properties = null
    this.traits = null
  }

  getRnsInitStatus(): boolean {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getRnsInitStatus'))
    return this.properties.rnsInitComplete
  }
  setRnsInitStatus(status: boolean): void {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'setRnsInitStatus'))
    this.properties.rnsInitComplete = status
  }
  getStorageInitStatus(): boolean {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getStorageInitStatus'))
    return this.properties.fileTreeInitComplete
  }
  setStorageInitStatus(status: boolean): void {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'setStorageInitStatus'))
    this.properties.fileTreeInitComplete = status
  }
  getProtoHandler(): IProtoHandler {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getProtoHandler'))
    return this.properties.pH
  }
  getQueryHandler(): IQueryHandler {
    return this.qH
  }
  getAccounts(): Promise<readonly AccountData[]> {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getAccounts'))
    return this.properties.signer.getAccounts()
  }
  getSigner(): OfflineSigner {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getSigner'))
    return this.properties.signer
  }
  getJackalAddress(): string {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getJackalAddress'))
    return this.properties.jackalAccount.address
  }
  async getHexJackalAddress(): Promise<string> {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getHexJackalAddress'))
    return await hashAndHex(this.properties.jackalAccount.address)
  }
  async getAllBalances(): Promise<ICoin[]> {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getAllBalances'))
    const res = await this.qH.bankQuery.queryAllBalances({
      address: this.properties.jackalAccount.address
    })
    return res.value.balances as ICoin[]
  }
  async getJackalBalance(): Promise<ICoin> {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getJackalBalance'))
    const res = await this.qH.bankQuery.queryBalance({
      address: this.properties.jackalAccount.address,
      denom: 'ujkl'
    })
    return res.value.balance as ICoin
  }
  getPubkey(): string {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'getPubkey'))
    return this.properties.keyPair.publicKey.toHex()
  }
  asymmetricEncrypt(toEncrypt: ArrayBuffer, pubKey: string): string {
    return encrypt(pubKey, Buffer.from(toEncrypt)).toString('hex')
  }
  asymmetricDecrypt(toDecrypt: string): ArrayBuffer {
    if (!this.properties) throw new Error(signerNotEnabled('WalletHandler', 'asymmetricDecrypt'))
    return new Uint8Array(
      decrypt(this.properties.keyPair.toHex(), Buffer.from(toDecrypt, 'hex'))
    )
  }
  async findPubKey(address: string): Promise<string> {
    const result = await this.qH.fileTreeQuery.queryPubkey({ address })
    if (!result.success) {
      throw new Error(`${address} does not have a pubkey registered`)
    } else {
      return (result.value.pubkey as Pubkey).key
    }
  }

  /**
   * Handler Factories
   */
  async makeAbciHandler (): Promise<IAbciHandler> {
    return await AbciHandler.trackAbci(this)
  }
  async makeFileIoHandler (versionFilter?: string | string[]): Promise<IFileIo | null> {
    return (this.traits) ? await FileIo.trackIo(this, versionFilter) : null
  }
  async makeGovHandler (): Promise<IGovHandler> {
    return await GovHandler.trackGov(this)
  }
  async makeNotificationHandler (): Promise<INotificationHandler> {
    return await NotificationHandler.trackNotification(this)
  }
  async makeOracleHandler (): Promise<IOracleHandler> {
    return await OracleHandler.trackOracle(this)
  }
  async makeRnsHandler (): Promise<IRnsHandler> {
    return await RnsHandler.trackRns(this)
  }
  /** TODO */
  // async makeSecretsHandler (enable: IEnabledSecrets): Promise<ISecretsHandler> {
  //   return await SecretsHandler.trackSecrets(this, enable)
  // }
  async makeSecretsHandler (): Promise<ISecretsHandler> {
    return await SecretsHandler.trackSecrets(this)
  }
  async makeStorageHandler (): Promise<IStorageHandler> {
    return await StorageHandler.trackStorage(this)
  }
}

async function makeSecret(
  chainId: string,
  acct: string,
  walletExtension: Keplr | Leap
): Promise<string> {
  const memo = 'Initiate Jackal Session'
  const signed = await walletExtension
    .signArbitrary(chainId, acct, memo)
    .catch((err) => {
      throw err
    })
  return signed.signature
}
async function processWallet (config: IWalletConfig, options?: IAdditionalWalletOptions) {
  const { selectedWallet, signerChain, enabledChains, queryAddr, txAddr, chainConfig } = config
  const chainId = signerChain || jackalMainnetChainId
  let windowWallet: Keplr | Leap
  switch (selectedWallet) {
    case 'keplr':
      if (!window.keplr) {
        throw new Error('Keplr Wallet selected but unavailable')
      }
      windowWallet = window.keplr
      break
    case 'leap':
      if (!window.leap) {
        throw new Error('Leap Wallet selected but unavailable')
      }
      windowWallet = window.leap
      break
    case 'custom':
      if (!options?.customWallet) {
        throw new Error('Custom Wallet selected but unavailable')
      }
      windowWallet = options.customWallet
      break
    default:
      throw new Error('A valid wallet selection must be provided')
  }
  await windowWallet.enable(enabledChains || defaultChains).catch((err) => {
    throw err
  })
  await windowWallet.experimentalSuggestChain(chainConfig)
  const signer = await windowWallet.getOfflineSignerAuto(chainId, {})
  const queryUrl = (queryAddr || defaultQueryAddr9091).replace(/\/+$/, '')
  const rpcUrl = (txAddr || defaultTxAddr26657).replace(/\/+$/, '')
  const jackalAccount = (await signer.getAccounts())[0]

  const pH = await ProtoHandler.trackProto({ signer, queryUrl, rpcUrl })
  const rnsInitComplete = (
    await pH.rnsQuery.queryInit({ address: jackalAccount.address })
  ).value.init
  const {
    value: { pubkey },
    success
  } = await pH.fileTreeQuery.queryPubkey({ address: jackalAccount.address })
  const secret = await makeSecret(
    chainId,
    jackalAccount.address,
    windowWallet
  ).catch((err) => {
    throw err
  })
  const fileTreeInitComplete = success && !!pubkey?.key
  const secretAsHex = bufferToHex(
    Buffer.from(secret, 'base64').subarray(0, 32)
  )
  const keyPair = PrivateKey.fromHex(secretAsHex)
  const isDirect = isOfflineDirectSigner(signer)

  const properties: IWalletHandlerPrivateProperties = {
    signer,
    keyPair,
    rnsInitComplete,
    fileTreeInitComplete,
    jackalAccount,
    pH
  }
  const traits: IWalletHandlerPublicProperties = {
    chainId,
    isDirect,
    walletProvider: selectedWallet
  }

  return { properties, traits }
}
