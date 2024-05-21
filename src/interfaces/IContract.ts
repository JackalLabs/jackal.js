import type { DCoin } from '@jackallabs/jackal.js-protos'

/**
 * The options of .instantiate() and .instantiate2() call.
 * All properties are optional.
 */
export interface IContractInstantiateOptions {
  readonly memo?: string;
  /**
   * The funds that are transferred from the sender to the newly created contract.
   * The funds are transferred as part of the message execution after the contract address is
   * created and before the instantiation message is executed by the contract.
   *
   * Only native tokens are supported.
   */
  readonly funds?: readonly DCoin[];
  /**
   * A bech32 encoded address of an admin account.
   * Caution: an admin has the privilege to upgrade a contract. If this is not desired, do not set this value.
   */
  readonly admin?: string;
}
