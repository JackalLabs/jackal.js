/**
 *
 * @interface ILoadThumbnailOptionsWithUlid
 * @property {string} userAddress - The Jackal address owning the data.
 * @property {string} filePath - The path to the File Meta.
 */
export interface ILoadThumbnailOptionsWithUlid {
  userAddress: string
  filePath: string
}

/**
 *
 * @interface ILoadThumbnailOptionsWithPath
 * @property {string} userAddress - The Jackal address owning the data.
 * @property {string} ulid - The ulid of the File Meta.
 */
export interface ILoadThumbnailOptionsWithPath {
  userAddress: string
  ulid: string
}

export type TLoadThumbnailOptions = ILoadThumbnailOptionsWithPath | ILoadThumbnailOptionsWithUlid
