import { Keplr } from '@keplr-wallet/types'
import { Leap } from '@/leap'
import { IMnemonicWallet } from '@/interfaces/classes'

export type TWalletExtensions = Keplr | Leap | IMnemonicWallet
export type TWalletExtensionNames = 'keplr' | 'leap' | 'mnemonic'
