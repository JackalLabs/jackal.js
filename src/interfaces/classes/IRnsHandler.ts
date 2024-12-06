import type {
  DBid,
  DForsale,
  DName,
  TQueryAllBidsResponseStrict,
  TQueryAllForSaleResponseStrict,
  TQueryAllNamesResponseStrict,
  TQueryListOwnedNamesResponseStrict,
} from '@jackallabs/jackal.js-protos'
import {
  IAcceptBidOptions,
  IAddSubRnsOptions,
  IBidOptions,
  IBroadcastOrChainOptions,
  IBuyOptions,
  ICancelBidOptions,
  IDelistOptions,
  IListOptions,
  IPageRequest,
  IRegisterOptions,
  IRemoveSubRnsOptions,
  ISetNewPrimaryOptions,
  ITransferOptions,
  IUpdateOptions,
  IWrappedEncodeObject,
} from '@/interfaces'
import { INameWithMeta, TAddressPrefix } from '@/types'

export interface IRnsHandler {
  getBidForSingleName (name: string): Promise<DBid>

  getBidsForAllNames (
    pagination?: IPageRequest,
  ): Promise<TQueryAllBidsResponseStrict>

  getNameForSale (name: string): Promise<DForsale>

  getAllNamesForSale (
    pagination?: IPageRequest,
  ): Promise<TQueryAllForSaleResponseStrict>

  getAllNames (pagination?: IPageRequest): Promise<TQueryAllNamesResponseStrict>

  getAllMyNames (
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict>

  getAllNamesInWallet (
    address: string,
    pagination?: IPageRequest,
  ): Promise<TQueryListOwnedNamesResponseStrict>

  getNameDetails (name: string): Promise<DName>

  getNameMetaDetails (name: string): Promise<INameWithMeta>

  getPrimaryName (address?: string): Promise<DName>

  possibleRnsToJklAddress (name: string): Promise<string>

  rnsToAddress (name: string, prefix?: TAddressPrefix): Promise<string>

  bid (options: IBidOptions): Promise<IWrappedEncodeObject[]>

  acceptBid (options: IAcceptBidOptions): Promise<IWrappedEncodeObject[]>

  cancelBid (options: ICancelBidOptions): Promise<IWrappedEncodeObject[]>

  list (options: IListOptions): Promise<IWrappedEncodeObject[]>

  delist (options: IDelistOptions): Promise<IWrappedEncodeObject[]>

  buy (options: IBuyOptions): Promise<IWrappedEncodeObject[]>

  activate (options?: IBroadcastOrChainOptions): Promise<IWrappedEncodeObject[]>

  register (options: IRegisterOptions): Promise<IWrappedEncodeObject[]>

  update (options: IUpdateOptions): Promise<IWrappedEncodeObject[]>

  transfer (options: ITransferOptions): Promise<IWrappedEncodeObject[]>

  addSubRns (options: IAddSubRnsOptions): Promise<IWrappedEncodeObject[]>

  removeSubRns (options: IRemoveSubRnsOptions): Promise<IWrappedEncodeObject[]>

  setNewPrimary (options: ISetNewPrimaryOptions): Promise<IWrappedEncodeObject[]>
}
