import type { INotification } from '@/interfaces'

export function formatNotification(msg: string): INotification {
  return {
    msg,
  }
}

export function formatShareNotification(
  path: string,
  isFile: boolean,
): INotification {
  const msg = `${isFile ? 'file' : 'folder'}|${path}`
  return formatNotification(msg)
}
