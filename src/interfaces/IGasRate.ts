import { Coin } from '@cosmjs/amino/build/coins'

export default interface IGasRate {
  amount: Coin[],
  gas: string
}
