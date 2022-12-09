import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IRnsHandler {
  createRnsInitMsg (): EncodeObject
  makeBuyMsg (rns: string): EncodeObject
  makeDelistMsg (rns: string): EncodeObject
  makeListMsg (rns: string, price: string): EncodeObject
  makeTransferMsg (rns: string, receiver: string): EncodeObject

  findExistingNames (): Promise<any[]>
  findMatchingAddress (rns: string): Promise<string>
}
