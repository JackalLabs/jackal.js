import { IChainConfig } from '@/interfaces'
import { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { StdSignature } from '@cosmjs/amino'

export default interface IBaseWallet {
  enable(chainIds: string | string[]): Promise<void>

  experimentalSuggestChain(chainConfig: IChainConfig): Promise<void>

  getOfflineSignerAuto(chainId: string): Promise<OfflineDirectSigner>

  signArbitrary(_: any, address: string, message: string): Promise<StdSignature>
}
