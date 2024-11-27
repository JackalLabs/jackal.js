import type { DName } from '@jackallabs/jackal.js-protos'
import { IRnsMetaData } from '@/interfaces'

export type TAddressPrefix =
  | 'jkl'
  | 'akash'
  | 'archway'
  | 'atom'
  | 'axelar'
  | 'bcna'
  | 'celestia'
  | 'chihuahua'
  | 'cre'
  | 'decentr'
  | 'juno'
  | 'kyve'
  | 'kujira'
  | 'neutron'
  | 'noble'
  | 'omniflix'
  | 'osmo'
  | 'qwoyn'
  | 'stars'
  | 'stride'

export interface INameWithMeta extends Omit<Omit<DName, 'subdomains'>, 'data'> {
  data: IRnsMetaData
  subdomains: INameWithMeta[]
}