import { IMiner } from '@/interfaces/index'

export default interface IProviderChecks {
  filtered: IMiner[]
  raw: IMiner[]
  verified: IMiner[]
}
