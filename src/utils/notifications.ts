import type { INotification } from '@/interfaces'

/**
 * Standardize notification message format.
 * @param {string} msg - Incoming notification message.
 * @returns {INotification} - Formatted message.
 */
export function formatNotification(msg: string): INotification {
  return {
    msg,
  }
}

/**
 * Standardize share notification message format.
 * @param {string} path - Path to shared resource.
 * @param {boolean} isFile - True if path points to a file.
 * @returns {INotification} - Formatted message.
 */
export function formatShareNotification(
  path: string,
  isFile: boolean,
): INotification {
  const msg = `${isFile ? 'file' : 'folder'}|${path}`
  return formatNotification(msg)
}
