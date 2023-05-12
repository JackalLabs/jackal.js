import { AccountData, OfflineSigner } from '@cosmjs/proto-signing'
import { ICoin } from '@/interfaces'
import { IProtoHandler } from '@/interfaces/classes'
import SuccessIncluded from 'jackal.js-protos/dist/types/TSuccessIncluded'
import { QueryPubkeyResponse } from 'jackal.js-protos/dist/postgen/canine_chain/filetree/query'

export default interface IWalletHandler {
  readonly chainId: string
  readonly isDirect: boolean

  getRnsInitStatus(): boolean
  setRnsInitStatus(status: boolean): void
  getStorageInitStatus(): boolean
  setStorageInitStatus(status: boolean): void
  getProtoHandler(): IProtoHandler
  getAccounts(): Promise<readonly AccountData[]>
  getSigner(): OfflineSigner
  getJackalAddress(): string
  getHexJackalAddress(): Promise<string>
  getAllBalances(): Promise<ICoin[]>
  getJackalBalance(): Promise<ICoin>
  getPubkey(): string
  asymmetricEncrypt(toEncrypt: ArrayBuffer, pubKey: string): string
  asymmetricDecrypt(toDecrypt: string): ArrayBuffer
  findPubKey(address: string): Promise<string>
}
