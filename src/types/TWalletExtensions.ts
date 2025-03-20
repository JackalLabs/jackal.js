import type { Keplr } from '@keplr-wallet/types'
import type { Leap } from '@/leap'
import type { IMnemonicWallet } from '@/interfaces/classes'

export type TWalletExtensions = Keplr | Leap | IMnemonicWallet
export type TWalletExtensionNames = 'keplr' | 'leap' | 'mnemonic' | 'evm'
