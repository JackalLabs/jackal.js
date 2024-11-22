import type { DFile } from '@jackallabs/jackal.js-protos'

/**
 *
 * @interface IListOptions
 * @property {DFile} file
 * @property {string} ulid
 * @property {[string, string]} [legacyPath]
 * @property {string} [linkKey]
 */
export interface ILoadMetaOptions {
  file: DFile
  ulid: string
  legacyPath?: [string, string]
  linkKey?: string
}
