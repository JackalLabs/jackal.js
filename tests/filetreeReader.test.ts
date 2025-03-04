import { beforeEach, describe, expect, it } from 'vitest'
import { PrivateKey } from 'eciesjs'
import { ClientHandler, FiletreeReader } from '@/classes'
import { signatureSeed } from '@/utils/globalDefaults'
import { stringToShaHex } from '@/utils/hash'
import { IClientHandler, IPathToLookupOptions } from '@/interfaces'
import { TJackalSigningClient } from '@jackallabs/jackal.js-protos'

class TestFiletreeReader extends FiletreeReader {
  constructor (
    client: IClientHandler,
    signer: TJackalSigningClient,
    privateKeyPair: PrivateKey,
    defaultKeyPair: PrivateKey,
    address: string,
  ) {
    super(
      client,
      signer,
      privateKeyPair,
      defaultKeyPair,
      address,
    )
  }

  async testPathToLookup (options: IPathToLookupOptions) {
    const lookup = await this.pathToLookup(options)
    const {
      path,
    } = options
    console.log('test ulid Home:', this.ulidLeaves[this.clientAddress][path])
    return lookup
  }
}

describe('FileTreeReader', () => {
  // new FiletreeReader(
  //   this.jackalClient,
  //   this.jackalSigner,
  //   keyPair,
  //   defaultKeyPair,
  //   this.jackalClient.getICAJackalAddress(),
  // )

  let reader: TestFiletreeReader

  beforeEach(async () => {
    const mnemonic = 'basic churn vote decide food faculty very odor load nephew link common illness forward fault person love behave half keen proud section destroy fork'

    const client = await ClientHandler.connect({
      selectedWallet: 'mnemonic',
      mnemonic,
    })
    const signer = client.getJackalSigner()
    let seedWallet
    if (typeof window !== 'undefined') {
      /* @ts-ignore */
      seedWallet = window.mnemonicWallet
    } else {
      /* @ts-ignore */
      seedWallet = global.mnemonicWallet
    }
    const signed = await seedWallet.signArbitrary(
      signatureSeed,
    )
    const signatureAsHex = await stringToShaHex(signed.signature)
    let privateKeyPair = PrivateKey.fromHex(signatureAsHex)
    let defaultKeyPair = PrivateKey.fromHex('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

    if (!signer) {
      throw new Error('signer invalid')
    }

    reader = new TestFiletreeReader(
      client,
      signer,
      privateKeyPair,
      defaultKeyPair,
      client.getICAJackalAddress(),
    )
  })

  it('setContents should update contents', async () => {
    // const meta = await NullMetaHandler.create({ location: '', refIndex: 0, ulid: '' })
    // reader.setContents('', meta.export())

  })

  it('pathToLookup should return a FileTree file', async () => {
    const file = await reader.testPathToLookup({ path: 'Home' })

    expect(file).toStrictEqual({
        "address": "cf7e85bd33b684f0b8f72d6a7f91f8f4da681d7e925d115588516fd4d992ad58",
        "ownerAddress": "abc409b6e2d1590b123508451d9c0283577a5bfeac08bc4702df69ca3413f8e9",
      })
  })

})
