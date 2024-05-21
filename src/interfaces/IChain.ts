export interface IChainConfig {
  chainId: string
  chainName: string
  rpc: string
  rest: string
  bip44: {
    coinType: number
  }
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
  currencies: IChainCurrency[]
  feeCurrencies: IChainCurrency[]
  features: string[]
}

export interface IChainCurrency {
  coinDenom: string
  coinMinimalDenom: string
  coinDecimals: number
  gasPriceStep?: {
    low: number
    average: number
    high: number
  }
}

export interface ISocketConfig {
  chainId: string
  endpoint: string
}
