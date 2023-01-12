import { IProtoHandler, IRnsHandler, IWalletHandler } from '@/interfaces/classes'
import { INames, IRnsBidItem, IRnsForSaleItem } from '@/interfaces'

import { EncodeObject } from '@cosmjs/proto-signing'
import IRnsRecordItem from '@/interfaces/IRnsRecordItem'
import IRnsRegistrationItem from '@/interfaces/IRnsRegistrationItem'

export default class RnsHandler implements IRnsHandler {
  private readonly walletRef: IWalletHandler
  private readonly pH: IProtoHandler

  private constructor (wallet: IWalletHandler) {
    this.walletRef = wallet
    this.pH = wallet.getProtoHandler()
  }

  static async trackRns (wallet: IWalletHandler): Promise<IRnsHandler> {
    return new RnsHandler(wallet)
  }

  makeAcceptBidMsg (rns: string, from: string): EncodeObject {
    return this.pH.rnsTx.msgAcceptBid({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns,
      from
    })
  }
  makeAddRecordMsg (recordValues: IRnsRecordItem): EncodeObject {
    return this.pH.rnsTx.msgAddRecord({
      creator: this.walletRef.getJackalAddress(),
      name: recordValues.name,
      value: recordValues.value,
      data: recordValues.data,
      record: recordValues.record
    });
  }
  makeBidMsg (rns: string, bid: string): EncodeObject {
    return this.pH.rnsTx.msgBid({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns,
      bid
    })
  }
  makeBuyMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgBuy({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns 
    })
  }
  makeCancelBidMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgCancelBid({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns
    })
  }
  makeDelistMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgDelist({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns })
  }
  makeDelRecordMsg (rns: string): EncodeObject {
    return this.pH.rnsTx.msgDelRecord({ 
      creator: this.walletRef.getJackalAddress(),
      name: rns
    })
  }
  makeRnsInitMsg (): EncodeObject {
    return this.pH.rnsTx.msgInit({ 
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeListMsg (rns: string, price: string): EncodeObject {
    return this.pH.rnsTx.msgList({
      creator: this.walletRef.getJackalAddress(),
      name: rns,
      price
    })
  }
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject {
    return this.pH.rnsTx.msgRegister({
      creator: this.walletRef.getJackalAddress(),
      name: registrationValues.nameToRegister,
      years: (Number(registrationValues.yearsToRegister) || 1).toString(),
      data: registrationValues.data
    })
  }
  makeTransferMsg (rns: string, receiver: string): EncodeObject {
    return this.pH.rnsTx.msgTransfer({
      creator: this.walletRef.getJackalAddress(),
      name: rns,
      receiver
    })
  }

  async findSingleBid (index: string): Promise<IRnsBidItem> {
    return (await this.pH.rnsQuery.queryBids({ index: index })).value.bids as IRnsBidItem
  }
  async findAllBids (): Promise<IRnsBidItem[]> {
    return (await this.pH.rnsQuery.queryBidsAll({})).value.bids
  }
  async findSingleForSaleName (rnsName: string): Promise<IRnsForSaleItem> {
    return (await this.pH.rnsQuery.queryForsale({ name: rnsName })).value.forsale as IRnsForSaleItem
  }
  async findAllForSaleNames (): Promise<IRnsForSaleItem[]> {
    return (await this.pH.rnsQuery.queryForsaleAll({})).value.forsale
  }
  async findExistingNames (): Promise<INames[]> {
    return (await this.pH.rnsQuery.queryListOwnedNames({ address: this.walletRef.getJackalAddress() })).value.names
  }
  async findMatchingAddress (rns: string): Promise<string> {
    const trueRns = (rns.endsWith('.jkl')) ? rns.replace(/.jkl$/, '') : rns
    return (await this.pH.rnsQuery.queryNames({ index: trueRns })).value.names?.value || ''
  }
}
