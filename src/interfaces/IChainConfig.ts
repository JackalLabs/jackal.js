import type { ICurrency } from '@/interfaces'

export default interface IChainConfig {
  chainId: string
  chainName: string
  rpc: string
  rest: string
  bip44: {
    coinType: number
  }
  coinType: number
  stakeCurrency: {
    coinDenom: string
    coinMinimalDenom: string
    coinDecimals: number
  }
  bech32Config: {
    bech32PrefixAccAddr: string
    bech32PrefixAccPub: string
    bech32PrefixValAddr: string
    bech32PrefixValPub: string
    bech32PrefixConsAddr: string
    bech32PrefixConsPub: string
  }
  currencies: ICurrency[]
  feeCurrencies: ICurrency[]
  features: string[]
}
