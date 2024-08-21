import type { SigningStargateClientOptions } from '@cosmjs/stargate'
import type { IChainConfig } from '@/interfaces'
import type { TSockets, TWalletExtensionNames } from '@/types'

export interface IClientSetup {
  host?: {
    chainConfig: IChainConfig
    chainId: string
    endpoint: string
  }
  chainConfig?: IChainConfig
  chainId?: string
  endpoint?: string
  mnemonic?: string
  options?: SigningStargateClientOptions
  selectedWallet?: TWalletExtensionNames
  networks?: TSockets[]
  gasMultiplier?: number
}

export type { SigningStargateClientOptions }
