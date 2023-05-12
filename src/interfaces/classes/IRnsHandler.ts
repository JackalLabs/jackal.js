import { EncodeObject } from '@cosmjs/proto-signing'
import {
  IRnsBidHashMap,
  IRnsBidItem,
  IRnsExpandedForSaleHashMap,
  IRnsForSaleHashMap,
  IRnsForSaleItem,
  IRnsOwnedHashMap,
  IRnsOwnedItem,
  IRnsRecordItem,
  IRnsRegistrationItem
} from '@/interfaces'

export default interface IRnsHandler {
  makeAcceptBidMsg(rns: string, from: string): EncodeObject
  makeAddRecordMsg(recordValues: IRnsRecordItem): EncodeObject
  makeBidMsg(rns: string, bid: string): EncodeObject
  makeBuyMsg(rns: string): EncodeObject
  makeCancelBidMsg(rns: string): EncodeObject
  makeDelistMsg(rns: string): EncodeObject
  makeDelRecordMsg(rns: string): EncodeObject
  makeRnsInitMsg(): EncodeObject
  makeListMsg(rns: string, price: string): EncodeObject
  makeNewRegistrationMsg(registrationValues: IRnsRegistrationItem): EncodeObject
  makeTransferMsg(rns: string, receiver: string): EncodeObject
  makeUpdateMsg(rns: string, data: string): EncodeObject

  findSingleBid(index: string): Promise<IRnsBidItem>
  findAllBids(): Promise<IRnsBidHashMap>
  findSingleForSaleName(rnsName: string): Promise<IRnsForSaleItem>
  findAllForSaleNames(): Promise<IRnsForSaleHashMap>
  findExpandedForSaleNames(): Promise<IRnsExpandedForSaleHashMap>
  findExistingNames(): Promise<IRnsOwnedHashMap>
  findSingleRns(rns: string): Promise<IRnsOwnedItem>
  findMatchingAddress(rns: string): Promise<string>
}
