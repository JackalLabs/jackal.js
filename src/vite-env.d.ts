/// <reference types="vite/client" />

import { Window as KeplrWindow } from '@keplr-wallet/types'

declare global {
  interface Window extends KeplrWindow, LeapWindow {}
}
