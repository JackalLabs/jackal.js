/// <reference types="long" />
import { AminoSignResponse, StdSignature, StdSignDoc } from '@cosmjs/amino'
import { DirectSignResponse, OfflineDirectSigner, OfflineSigner } from '@cosmjs/proto-signing'
import { BroadcastMode } from 'cosmjs-types/cosmos/tx/v1beta1/service'
import { ChainInfo } from './chain-info'

export interface Key {
  readonly name: string
  readonly algo: string
  readonly pubKey: Uint8Array
  readonly address: Uint8Array
  readonly bech32Address: string
  readonly isNanoLedger: boolean
}
export interface Leap {
  enable(chainds: string | string[]): Promise<void>
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>
  getKey(chainId: string): Promise<Key>
  signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions?: LeapSignOptions
  ): Promise<AminoSignResponse>
  signDirect(
    chainId: string,
    signer: string,
    signDoc: {
      /** SignDoc bodyBytes */
      bodyBytes?: Uint8Array | null
      /** SignDoc authInfoBytes */
      authInfoBytes?: Uint8Array | null
      /** SignDoc chainId */
      chainId?: string | null
      /** SignDoc accountNumber */
      accountNumber?: Long | null
    },
    signOptions?: LeapSignOptions
  ): Promise<DirectSignResponse>
  signArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array
  ): Promise<StdSignature>
  sendTx(
    chainId: string,
    tx: Uint8Array,
    mode: BroadcastMode
  ): Promise<Uint8Array>
  suggestToken(
    chainId: string,
    contractAddress: string,
    viewingKey?: string
  ): Promise<void>
  getSecret20ViewingKey(
    chainId: string,
    contractAddress: string
  ): Promise<string>
  getEnigmaPubKey(chainId: string): Promise<Uint8Array>
  getEnigmaTxEncryptionKey(
    chainId: string,
    nonce: Uint8Array
  ): Promise<Uint8Array>
  enigmaEncrypt(
    chainId: string,
    contractCodeHash: string,
    msg: object
  ): Promise<Uint8Array>
  enigmaDecrypt(
    chainId: string,
    ciphertext: Uint8Array,
    nonce: Uint8Array
  ): Promise<Uint8Array>
  getOfflineSigner: (
    chainId: string,
    signOptions: LeapSignOptions
  ) => OfflineSigner & OfflineDirectSigner
  getOfflineSignerAmino: (
    chainId: string,
    signOptions: LeapSignOptions
  ) => OfflineSigner
  getOfflineSignerAuto: (
    chainId: string,
    signOption: LeapSignOptions
  ) => Promise<OfflineSigner | OfflineDirectSigner>
  getEnigmaUtils: (chainId: string) => LeapEnigmaUtils
}

export class LeapEnigmaUtils {
  protected readonly chainId: string
  protected readonly leap: Leap
  constructor(chainId: string, leap: Leap)
  getPubkey(): Promise<Uint8Array>
  getTxEncryptionKey(nonce: Uint8Array): Promise<Uint8Array>
  encrypt(contractCodeHash: string, msg: object): Promise<Uint8Array>
  decrypt(ciphertext: Uint8Array, nonce: Uint8Array): Promise<Uint8Array>
}
export type LeapMode = 'core' | 'extension' | 'mobile-web' | 'walletconnect'
export interface LeapSignOptions {
  /** If true the wallet will not override the fee during transaction signing  */
  readonly preferNoSetFee?: boolean
}
export interface LeapIntereactionOptions {
  readonly sign?: LeapSignOptions
}

export interface LeapWindow {
  leap: Leap
}

declare global {
  interface Window extends LeapWindow {}
}
