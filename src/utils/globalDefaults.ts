import type { IChainConfig, ISocketConfig } from '@/interfaces'
import type { TSockets } from '@/types'

export const sharedPath = 'dashboard_sharedfiles'

export const signatureSeed: string =
  'Initiate Jackal Session' /* Don't ever change this! */
export const chunkSize: number = 10240 /* In bytes. Don't ever change this! */
export const encryptionChunkSize: number =
  32 * Math.pow(1024, 2) /* In bytes. This number can change */
export const assumedBlockTime: number = 6 /* In seconds. This number can change but shouldn't be */

export const jackalTestnetRpc: string =
  'https://testnet-rpc.jackalprotocol.com/'
export const jackalTestnetChainId: string = 'lupulella-2'
export const jackalMainnetChainId: string = 'jackal-1'

export const jackalTestnetChainConfig: IChainConfig = {
  chainId: jackalTestnetChainId,
  chainName: 'Jackal Testnet II',
  rpc: 'https://testnet-rpc.jackalprotocol.com',
  rest: 'https://testnet-api.jackalprotocol.com',
  bip44: {
    coinType: 118,
  },
  stakeCurrency: {
    coinDenom: 'JKL',
    coinMinimalDenom: 'ujkl',
    coinDecimals: 6,
  },
  bech32Config: {
    bech32PrefixAccAddr: 'jkl',
    bech32PrefixAccPub: 'jklpub',
    bech32PrefixValAddr: 'jklvaloper',
    bech32PrefixValPub: 'jklvaloperpub',
    bech32PrefixConsAddr: 'jklvalcons',
    bech32PrefixConsPub: 'jklvalconspub',
  },
  currencies: [
    {
      coinDenom: 'JKL',
      coinMinimalDenom: 'ujkl',
      coinDecimals: 6,
    },
  ],
  feeCurrencies: [
    {
      coinDenom: 'JKL',
      coinMinimalDenom: 'ujkl',
      coinDecimals: 6,
      gasPriceStep: {
        low: 0.002,
        average: 0.002,
        high: 0.02,
      },
    },
  ],
  features: [],
}

export const keyAlgo: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256,
}

export const sockets: Record<TSockets, ISocketConfig> = {
  jackal: {
    chainId: 'jackal-1',
    endpoint: 'wss://rpc.jackalprotocol.com',
    gasMultiplier: 1100
  },
  jackaltest: {
    chainId: 'lupulella-2',
    endpoint: 'wss://testnet-rpc.jackalprotocol.com',
    gasMultiplier: 1100
  },
  jackalv4: {
    chainId: 'mesomelas-1',
    endpoint: 'wss://jackal-testnet-v4-rpc.brocha.in',
    gasMultiplier: 1100
  },
  jackallocal: {
    chainId: 'puppy-1',
    endpoint: 'ws://localhost:62744',
    gasMultiplier: 1100
  },
  archway: {
    chainId: 'archway-1',
    endpoint: 'wss://rpc.mainnet.archway.io',
    gasMultiplier: 2200
  },
  archwaytest: {
    chainId: 'constantine-3',
    endpoint: 'wss://rpc.constantine.archway.io',
    gasMultiplier: 2200
  },
  wasm: {
    chainId: 'localwasm-1',
    endpoint: 'ws://localhost:62784',
    gasMultiplier: 2000
  },
}
