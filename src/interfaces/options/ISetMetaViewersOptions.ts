/**
 *
 * @interface ISetMetaViewersPath
 * @param {string} path - Path of resource.
 * @param {string[]} additionalViewers - Array of wallet addresses.
 */
export interface ISetMetaViewersPath {
  path: string
  additionalViewers: string[]
}

/**
 *
 * @interface ISetMetaViewersUlid
 * @param {string} ulid - Ulid of resource.
 * @param {string[]} additionalViewers - Array of wallet addresses.
 */
export interface ISetMetaViewersUlid {
  ulid: string
  additionalViewers: string[]
}

export type TSetMetaViewersOptions = ISetMetaViewersPath | ISetMetaViewersUlid
