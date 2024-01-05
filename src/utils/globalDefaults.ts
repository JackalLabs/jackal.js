import { IChainConfig } from '@/interfaces'

export const signatureSeed: string = 'Initiate Jackal Session' /* Don't ever change this! */
export const chunkSize: number = 10240 /* In bytes. Don't ever change this! */
export const encryptionChunkSize: number = 32 * Math.pow(1024, 2) /* In bytes. This number can change */
export const assumedBlockTime: number = 6 /* In seconds. This number can change but shouldn't be */

export const jackalTestnetRpc: string = 'https://testnet-rpc.jackalprotocol.com/'
export const jackalTestnetChainId: string = 'lupulella-2'
export const jackalMainnetChainId: string = 'jackal-1'

export const jackalTestnetChainConfig: IChainConfig = {
  chainId: jackalTestnetChainId,
  chainName: 'Jackal Testnet II',
  rpc: 'https://testnet-rpc.jackalprotocol.com',
  rest: 'https://testnet-api.jackalprotocol.com',
  bip44: {
    coinType: 118
  },
  stakeCurrency: {
    coinDenom: 'JKL',
    coinMinimalDenom: 'ujkl',
    coinDecimals: 6
  },
  bech32Config: {
    bech32PrefixAccAddr: 'jkl',
    bech32PrefixAccPub: 'jklpub',
    bech32PrefixValAddr: 'jklvaloper',
    bech32PrefixValPub: 'jklvaloperpub',
    bech32PrefixConsAddr: 'jklvalcons',
    bech32PrefixConsPub: 'jklvalconspub'
  },
  currencies: [
    {
      coinDenom: 'JKL',
      coinMinimalDenom: 'ujkl',
      coinDecimals: 6
    }
  ],
  feeCurrencies: [
    {
      coinDenom: 'JKL',
      coinMinimalDenom: 'ujkl',
      coinDecimals: 6,
      gasPriceStep: {
        low: 0.002,
        average: 0.002,
        high: 0.02
      }
    }
  ],
  features: []
}

export const keyAlgo: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256
}
