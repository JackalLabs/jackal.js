import { EncodeObject } from '@cosmjs/proto-signing'
import IRnsRegistrationItem from '@/interfaces/IRnsRegistrationItem'
import { INames, IRnsBidItem, IRnsForSaleItem } from '@/interfaces'

export default interface IRnsHandler {
  makeRnsInitMsg (): EncodeObject
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject
  makeBuyMsg (rns: string): EncodeObject
  makeDelistMsg (rns: string): EncodeObject
  makeListMsg (rns: string, price: string): EncodeObject
  makeTransferMsg (rns: string, receiver: string): EncodeObject

  findSingleBid (index: string): Promise<IRnsBidItem>
  findAllBids (): Promise<IRnsBidItem[]>
  findSingleForSaleName (rnsName: string): Promise<IRnsForSaleItem>
  findAllForSaleNames (): Promise<IRnsForSaleItem[]>
  findExistingNames (): Promise<INames[]>
  findMatchingAddress (rns: string): Promise<string>
}
