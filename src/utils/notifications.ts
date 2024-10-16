import type { INotification } from '@/interfaces'

/**
 * Standardize notification message format.
 * @param {string} msg - Incoming notification message.
 * @returns {INotification} - Formatted message.
 */
export function formatNotification (msg: string): INotification {
  return {
    msg,
  }
}

/**
 * Standardize share notification message format.
 * @param {string} ulid - ULID of shared resource.
 * @param {boolean} isFile - True if ulid points to a file.
 * @returns {INotification} - Formatted message.
 */
export function formatShareNotification (
  ulid: string,
  isFile: boolean,
): INotification {
  const msg = `${isFile ? 'file' : 'folder'}|${ulid}`
  return formatNotification(msg)
}
