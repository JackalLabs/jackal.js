import { signerNotEnabled, warnError } from '@/utils/misc'
import type {
  DEncodeObject,
  DQuerySmartContractStateRequest,
  THostSigningClient,
  TJackalSigningClient,
} from '@jackallabs/jackal.js-protos'
import type { IClientHandler } from '@/interfaces'
import { stringToUint8Array, uintArrayToString } from '@/utils/converters'
import { EncodingHandler } from '@/classes/encodingHandler'
import { PrivateKey } from 'eciesjs'
import { stringToShaHex } from '@/utils/hash'
import { IEvmHandler } from '@/interfaces/classes/IEvmHandler'
import { getAccount, connect, switchChain, injected, writeContract } from '@wagmi/core'
import { evmConfig } from '@/utils/globalDefaults'
import { baseSepolia } from '@wagmi/core/chains'
import { RootABI } from '@/utils/abis'
import { DeliverTxResponse } from '@cosmjs/stargate'

export class EvmHandler extends EncodingHandler implements IEvmHandler {
  protected constructor (
    client: IClientHandler,
    jackalSigner: TJackalSigningClient,
    hostSigner: THostSigningClient,
    keyPair: PrivateKey,
  ) {
    super(client, jackalSigner, hostSigner, keyPair, keyPair)
  }

  /**
   * Initialize wasm handler.
   * @param {IClientHandler} client - Instance of ClientHandler.
   * @returns {Promise<IWasmHandler>} - Instance of WasmHandler.
   */
  static async init (client: IClientHandler): Promise<IEvmHandler> {
    try {
      const jackalSigner = client.getJackalSigner()
      if (!jackalSigner) {
        throw new Error(signerNotEnabled('WasmHandler', 'init'))
      }
      const hostSigner = client.getHostSigner()
      if (!hostSigner) {
        throw new Error(signerNotEnabled('WasmHandler', 'init'))
      }

      const chainId = baseSepolia.id

      const connectResult = await connect(evmConfig, { connector: injected() })
      console.log(connectResult.chainId)

      if (chainId !== connectResult.chainId) {
        console.log("didn't match, switching")
        await switchChain(evmConfig, { chainId: chainId})
      }

      const { address } = getAccount(evmConfig)

      console.log("EVM ADDRESS: ", address)

      let dummyKey = await stringToShaHex('')
      const keyPair = PrivateKey.fromHex(dummyKey)
      return new EvmHandler(client, jackalSigner, hostSigner, keyPair)
    } catch (err) {
      throw warnError('wasmHandler init()', err)
    }
  }

  /**
   * Get jkl address from unknown Interchain contract.
   * @param {string} contractAddress - Contract to query from
   * @returns {Promise<string>}
   */
  async getEVMJackalAddress (contractAddress: string): Promise<string> {
    try {
      return this.getJackalAddressFromContract(contractAddress)
    } catch (err) {
      throw warnError('wasmHandler getICAJackalAddress()', err)
    }
  }

  /**
   * Get jkl address from known Interchain contract.
   * @param {string} contractAddress - Target Interchain contract.
   * @returns {Promise<string>} - Jkl address.
   */
  async getJackalAddressFromContract (contractAddress: string): Promise<string> {
    return "jkl1a39k9lslglwwruzgk04efva5mdpw2er509tmg5fn5jde6uanjtzq4d0r5u"
    try {
      const retries = 30
      let attempt = 0
      while (attempt < retries) {
        try {
          const query = { get_contract_state: {} }
          const req: DQuerySmartContractStateRequest = {
            address: contractAddress,
            queryData: stringToUint8Array(JSON.stringify(query)),
          }
          console.log(req)
          const res = await this.hostSigner.queries.cosmwasm.smartContractState(req)
          const str = uintArrayToString(res.data as Uint8Array)
          console.log(str)
          const data = JSON.parse(str)
          if ('ica_info' in data) {
            return data.ica_info.ica_address
          }
          attempt++
          await new Promise(r => setTimeout(r, 5000))
        } catch (err) {
          console.warn('wasmHandler getJackalAddressFromContract()', err)
        }
      }
      throw new Error('can\'t get details from contract')
    } catch (err) {
      throw warnError('wasmHandler getJackalAddressFromContract()', err)
    }
  }

  getEthPrice = async (): Promise<number> => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`
      );
      const data = await response.json();
      console.log(data)
      return data["ethereum"].usd;
    } catch (error) {
      console.error("Error fetching ETH price:", error);
      throw error;
    }
  };


  getStoragePrice(price: number, filesize: number, duration: number): number {
    const storagePrice = 15; // Price per TB in USD with 8 decimal places
    const multiplier = 2;
    const months = duration / 30; // Duration in months (200 years)

    let fs = filesize;
    if (fs <= 1024 * 1024) {
      fs = 1024 * 1024; // Minimum size is 1 MB
    }

    // Base Storage Multiplier (BSM): storage price calculation
    const BSM = storagePrice * multiplier * months * fs;

    // Calculate price in equivalent "wei" (for parallel logic, use integer math)
    // 1e18 converts to smallest ETH units
    const priceInWei = (BSM * 1e18) / (price * 1099511627776);

    // If the result is zero (due to rounding or too small), set a minimum value
    if (priceInWei === 0) {
      return 5000; // Return a minimum value (e.g., 5000 units of currency)
    }

    return Math.ceil(priceInWei);
  }

  /**
   * Prep DEncodeObject array for processing by Interchain Accounts.
   * @param {string} contract - Target contract.
   * @param {DEncodeObject[]} msgs - Array of messages.
   * @returns {DEncodeObject[]} - Processed array of wrapped messages.
   */
  signAndBroadcast (
    msgs: DEncodeObject[],
  ): Promise<DeliverTxResponse> {

    return new Promise(async () => {
      console.log(msgs)

      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i]
        console.log(m)
        if (m.typeUrl === "/canine_chain.storage.MsgBuyStorage") {
          const v = m.value

          const price = await this.getEthPrice()
          const p = this.getStoragePrice(price, v.bytes, v.durationDays);
          const wei = Math.floor(p * 1.05);
          console.log("price: " + wei);

          const s: any= {
            abi: RootABI,
            address: "0x5d26f092717A538B446A301C2121D6C68157467C",
            functionName: "buyStorage",
            args: [await this.getEVMJackalAddress(""), v.durationDays, v.bytes, v.referral],
            chainId: baseSepolia.id,
            value: BigInt(wei),
          }
          console.log(s)
          const result = await writeContract(evmConfig, s)
          console.log(result)
        } else if (m.typeUrl === "/canine_chain.filetree.MsgPostKey") {
          const v = m.value

          const s: any= {
            abi: RootABI,
            address: "0x5d26f092717A538B446A301C2121D6C68157467C",
            functionName: "postKey",
            args: [v.key],
            chainId: baseSepolia.id,
          }
          console.log(s)
          const result = await writeContract(evmConfig, s)
          console.log(result)
        } else if (m.typeUrl === "/canine_chain.filetree.MsgProvisionFileTree") {
          const v = m.value
          const s: any= {
            abi: RootABI,
            address: "0x5d26f092717A538B446A301C2121D6C68157467C",
            functionName: "provisionFileTree",
            args: [v.editors, v.viewers, v.trackingNumber],
            chainId: baseSepolia.id,
          }
          console.log(s)
          const result = await writeContract(evmConfig, s)
          console.log(result)
        }else if (m.typeUrl === "/canine_chain.filetree.MsgPostFile") {
          const v = m.value
          const s: any= {
            abi: RootABI,
            address: "0x5d26f092717A538B446A301C2121D6C68157467C",
            functionName: "postFileTree",
            args: [v.account, v.hashParent, v.hashChild,  v.contents, v.viewers, v.editors, v.trackingNumber],
            chainId: baseSepolia.id,
          }
          console.log(s)
          const result = await writeContract(evmConfig, s)
          console.log(result)
        }
      }

      const r: DeliverTxResponse = {
        height: 0,
        code: 0,
        events: [],
        msgResponses: [],
        txIndex: 0,
        transactionHash: "",
        gasUsed: BigInt(0),
        gasWanted: BigInt(0)
      }

      return r
    })


  }
}
