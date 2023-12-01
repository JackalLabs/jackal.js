import { ISampleHandler } from '@/interfaces/classes'

export class SampleHandler implements ISampleHandler {
  protected readonly savedInput: string

  protected constructor(inputAsString: string) {
    this.savedInput = inputAsString
  }

  static async trackFile(input: number): Promise<ISampleHandler> {
    const inputAsString = input.toString()
    return new SampleHandler(inputAsString)
  }

  receiveBacon(): string {
    return this.savedInput
  }
}
