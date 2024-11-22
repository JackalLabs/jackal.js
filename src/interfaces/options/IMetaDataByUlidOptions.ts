/**
 *
 * @interface IMetaDataByUlidOptions
 * @property {string} ulid - The ulid of the data.
 * @property {string} [userAddress] - The Jackal address owning the data.
 * @property {string} [linkKey] - The key to unlock the data if this was shared via link.
 */
export interface IMetaDataByUlidOptions {
  ulid: string
  userAddress?: string
  linkKey?: string
}
