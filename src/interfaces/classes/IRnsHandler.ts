export default interface IRnsHandler {
  findExistingNames (): Promise<any[]>
  findMatchingAddress (rns: string): Promise<string>
}
