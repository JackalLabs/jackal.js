/**
 *
 * @interface ISetMetaViewersPath
 * @param {string} path - Path of resource.
 * @param {TViewerSetAll} viewers - Object with properties of if update or overwrite is needed.
 */
export interface ISetMetaViewersPath {
  path: string
  viewers: TViewerSetAll
}

/**
 *
 * @interface ISetMetaViewersUlid
 * @param {string} ulid - Ulid of resource.
 * @param {TViewerSetAll} viewers - Object with properties of if update or overwrite is needed.
 */
export interface ISetMetaViewersUlid {
  ulid: string
  viewers: TViewerSetAll
}

/**
 * @interface IViewerSetOverwrite
 * @param {string[]} overwrite - Array of wallet addresses.
 */
export interface IViewerSetOverwrite {
  overwrite: string[]
}

/**
 * @interface IViewerSetAddRemove
 * @param {string[]} [add] - Array of wallet addresses.
 * @param {string[]} [remove] - Array of wallet addresses.
 */
export interface IViewerSetAddRemove {
  add?: string[]
  remove?: string[]
}

export type TViewerSetAll = IViewerSetOverwrite | IViewerSetAddRemove
export type TSetMetaViewersOptions = ISetMetaViewersPath | ISetMetaViewersUlid
