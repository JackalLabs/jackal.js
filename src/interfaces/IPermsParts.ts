import { IAesBundle } from '@/interfaces/index'
import { TPermsBlockBases } from '@/types/TPermsBlockBases'

export default interface IPermsParts {
  aes: IAesBundle
  base: TPermsBlockBases
  num: string
  pubKey: string
  usr: string
}
