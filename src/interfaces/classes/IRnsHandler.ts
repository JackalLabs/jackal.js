import { EncodeObject } from '@cosmjs/proto-signing'

export default interface IRnsHandler {
  makeFreeRns (): EncodeObject
  findExistingNames (): Promise<any[]>
  findMatchingAddress (rns: string): Promise<string>
}
