import { EncodeObject } from '@cosmjs/proto-signing'
import IRnsRegistrationItem from '@/interfaces/IRnsRegistrationItem'
import { INames, IRnsForSaleItem } from '@/interfaces'

export default interface IRnsHandler {
  makeRnsInitMsg (): EncodeObject
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject
  makeBuyMsg (rns: string): EncodeObject
  makeDelistMsg (rns: string): EncodeObject
  makeListMsg (rns: string, price: string): EncodeObject
  makeTransferMsg (rns: string, receiver: string): EncodeObject

  findSingleForSaleName (rnsName: string): Promise<IRnsForSaleItem>
  findAllForSaleNames (): Promise<IRnsForSaleItem[]>
  findExistingNames (): Promise<INames[]>
  findMatchingAddress (rns: string): Promise<string>
}
