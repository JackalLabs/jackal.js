import { EncodeObject } from '@cosmjs/proto-signing'
import { IProtoHandler, IRnsHandler, IWalletHandler } from '@/interfaces/classes'
import { INames, IRnsBidItem, IRnsForSaleItem, IRnsRecordItem, IRnsRegistrationItem } from '@/interfaces'

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
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgAcceptBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      from
    })
  }
  makeAddRecordMsg (recordValues: IRnsRecordItem): EncodeObject {
    const trueRns = sanitizeRns(recordValues.name)
    return this.pH.rnsTx.msgAddRecord({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      value: recordValues.value,
      data: recordValues.data || '{}',
      record: recordValues.record
    });
  }
  makeBidMsg (rns: string, bid: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      bid
    })
  }
  makeBuyMsg (rns: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgBuy({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }
  makeCancelBidMsg (rns: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgCancelBid({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }
  makeDelistMsg (rns: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgDelist({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns })
  }
  makeDelRecordMsg (rns: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgDelRecord({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns
    })
  }
  makeRnsInitMsg (): EncodeObject {
    return this.pH.rnsTx.msgInit({
      creator: this.walletRef.getJackalAddress()
    })
  }
  makeListMsg (rns: string, price: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgList({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      price
    })
  }
  makeNewRegistrationMsg (registrationValues: IRnsRegistrationItem): EncodeObject {
    const trueRns = sanitizeRns(registrationValues.nameToRegister)
    return this.pH.rnsTx.msgRegister({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      years: (Number(registrationValues.yearsToRegister) || 1).toString(),
      data: registrationValues.data || '{}'
    })
  }
  makeTransferMsg (rns: string, receiver: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgTransfer({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      receiver
    })
  }
  makeUpdateMsg (rns: string, data: string): EncodeObject {
    const trueRns = sanitizeRns(rns)
    return this.pH.rnsTx.msgUpdate({
      creator: this.walletRef.getJackalAddress(),
      name: trueRns,
      data: (data.length > 1) ? data : '{}'
    })
  }


  async findSingleBid (index: string): Promise<IRnsBidItem> {
    const trueIndex = sanitizeRns(index)
    return (await this.pH.rnsQuery.queryBids({ index: trueIndex })).value.bids as IRnsBidItem
  }
  async findAllBids (): Promise<IRnsBidItem[]> {
    return (await this.pH.rnsQuery.queryBidsAll({})).value.bids
  }
  async findSingleForSaleName (rns: string): Promise<IRnsForSaleItem> {
    const trueRns = sanitizeRns(rns)
    return (await this.pH.rnsQuery.queryForsale({ name: trueRns })).value.forsale as IRnsForSaleItem
  }
  async findAllForSaleNames (): Promise<IRnsForSaleItem[]> {
    return (await this.pH.rnsQuery.queryForsaleAll({})).value.forsale
  }
  async findExistingNames (): Promise<INames[]> {
    return (await this.pH.rnsQuery.queryListOwnedNames({ address: this.walletRef.getJackalAddress() })).value.names
  }
  async findMatchingAddress (rns: string): Promise<string> {
    const trueRns = sanitizeRns(rns)
    return (await this.pH.rnsQuery.queryNames({ index: trueRns })).value.names?.value || ''
  }
}

function sanitizeRns (rns: string): string {
  const allowedExtensions = /\.(jkl|ibc)$/
  return (rns.match(allowedExtensions)) ? rns : `${rns}.jkl`
}
