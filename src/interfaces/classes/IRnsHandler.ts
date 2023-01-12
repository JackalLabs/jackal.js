import { EncodeObject } from '@cosmjs/proto-signing'
import IRnsRecordItem from '../IRnsRecordItem'
import IRnsRegistrationItem from '@/interfaces/IRnsRegistrationItem'
import { INames, IRnsBidItem, IRnsForSaleItem } from '@/interfaces'

export default interface IRnsHandler {
  makeAcceptBidMsg (rns: string, from: string): EncodeObject
  makeAddRecordMsg (recordValues: IRnsRecordItem): EncodeObject
  makeBidMsg (rns: string, bid: string): EncodeObject
  makeBuyMsg (rns: string): EncodeObject
  makeCancelBidMsg (rns: string): EncodeObject
  makeDelistMsg (rns: string): EncodeObject
  makeDelRecordMsg (rns: string): EncodeObject
  makeRnsInitMsg (): EncodeObject
  makeListMsg (rns: string, price: string): EncodeObject
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject
  makeTransferMsg (rns: string, receiver: string): EncodeObject

  findSingleBid (index: string): Promise<IRnsBidItem>
  findAllBids (): Promise<IRnsBidItem[]>
  findSingleForSaleName (rnsName: string): Promise<IRnsForSaleItem>
  findAllForSaleNames (): Promise<IRnsForSaleItem[]>
  findExistingNames (): Promise<INames[]>
  findMatchingAddress (rns: string): Promise<string>
}
