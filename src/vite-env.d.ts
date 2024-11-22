/// <reference types="vite/client" />

import { Window as KeplrWindow } from '@keplr-wallet/types'
import { MnemonicWallet } from '@/classes'

declare global {
  interface Window extends KeplrWindow, LeapWindow {
    mnemonicWallet?: MnemonicWallet
  }

  var mnemonicWallet: MnemonicWallet
}
