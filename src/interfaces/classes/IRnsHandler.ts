import { EncodeObject } from '@cosmjs/proto-signing'
import {
  IPaginatedMap,
  IPagination,
  IRnsBidHashMap,
  IRnsBidItem,
  IRnsExpandedForSaleHashMap,
  IRnsForSaleHashMap,
  IRnsForSaleItem,
  IRnsItem,
  IRnsOwnedHashMap,
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
  findSomeForSaleNames(
    options?: IPagination
  ): Promise<IPaginatedMap<IRnsForSaleHashMap>>
  findAllForSaleNames(blockTime?: number): Promise<IRnsExpandedForSaleHashMap>
  findExpandedForSaleNames(
    blockTime?: number
  ): Promise<IRnsExpandedForSaleHashMap>
  findMyExistingNames(blockTime?: number): Promise<IRnsOwnedHashMap>
  findYourExistingNames(
    address: string,
    blockTime?: number
  ): Promise<IRnsOwnedHashMap>
  findSingleRns(rns: string): Promise<IRnsItem>
  findMatchingAddress(rns: string): Promise<string>
}
