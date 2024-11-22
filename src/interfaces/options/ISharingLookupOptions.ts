/**
 *
 * @interface ISharingLookupOptions
 * @property {true} [refresh] - If the Sharing list should be refreshed.
 * @property {string} [sharer] - JKL address to find list of shared resources.
 */
export interface ISharingLookupOptions {
  refresh?: true
  sharer?: string
}
