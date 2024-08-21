import { DCoin, DEncodeObject } from '@jackallabs/jackal.js-protos'

export interface IGasRate {
  amount: DCoin[]
  gas: string
}

export interface IFinalGas {
  fee: IGasRate
  msgs: DEncodeObject[]
}
