import { SigningStargateClientOptions } from '@cosmjs/stargate'
import { IChainConfig } from '@/interfaces'
import { TWalletExtensionNames } from '@/types'

export interface IClientSetup {
  chainConfig?: IChainConfig
  chainId?: string
  endpoint?: string
  mnemonic?: string
  options?: SigningStargateClientOptions
  selectedWallet?: TWalletExtensionNames
}
