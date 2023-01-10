import { EncodeObject } from '@cosmjs/proto-signing'
import IRnsRegistrationItem from '@/interfaces/IRnsRegistrationItem'

export default interface IRnsHandler {
  makeRnsInitMsg (): EncodeObject
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject
  makeBuyMsg (rns: string): EncodeObject
  makeDelistMsg (rns: string): EncodeObject
  makeListMsg (rns: string, price: string): EncodeObject
  makeTransferMsg (rns: string, receiver: string): EncodeObject

  findExistingNames (): Promise<any[]>
  findMatchingAddress (rns: string): Promise<string>
}
