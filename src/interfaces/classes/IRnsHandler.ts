import type {
  DBid,
  DCoin,
  DDeliverTxResponse,
  DForsale,
  DName,
  TQueryAllBidsResponseStrict,
  TQueryAllForSaleResponseStrict,
  TQueryAllNamesResponseStrict,
  TQueryListOwnedNamesResponseStrict,
} from '@jackallabs/jackal.js-protos'
import type { IPageRequest, IRnsData } from '@/interfaces'
import type { TAddressPrefix } from '@/types'

export interface IRnsHandler {
  getBidForSingleName(name: string): Promise<DBid>

  getBidsForAllNames(
    pagination?: IPageRequest,
  ): Promise<TQueryAllBidsResponseStrict>

  getNameForSale(name: string): Promise<DForsale>

  getAllNamesForSale(
    pagination?: IPageRequest,
  ): Promise<TQueryAllForSaleResponseStrict>

  getAllNames(pagination?: IPageRequest): Promise<TQueryAllNamesResponseStrict>

  getAllMyNames(
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict>

  getAllNamesInWallet(
    address: string,
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict>

  getNameDetails(name: string): Promise<DName>

  rnsToAddress(name: string, prefix?: TAddressPrefix): Promise<string>

  bid(rns: string, bid: DCoin): Promise<DDeliverTxResponse>

  acceptBid(rns: string, from: string): Promise<DDeliverTxResponse>

  cancelBid(rns: string): Promise<DDeliverTxResponse>

  list(rns: string, price: DCoin): Promise<DDeliverTxResponse>

  delist(rns: string): Promise<DDeliverTxResponse>

  buy(rns: string): Promise<DDeliverTxResponse>

  init(): Promise<DDeliverTxResponse>

  register(
    rns: string,
    yearsToRegister: number,
    data?: IRnsData,
  ): Promise<DDeliverTxResponse>

  update(rns: string, data?: IRnsData): Promise<DDeliverTxResponse>

  transfer(rns: string, receiver: string): Promise<DDeliverTxResponse>

  addSubRns(
    rns: string,
    linkedWallet: string,
    subRns: string,
    data?: IRnsData,
  ): Promise<DDeliverTxResponse>

  removeSubRns(rns: string): Promise<DDeliverTxResponse>
}
