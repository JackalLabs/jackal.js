export interface ISharedUpdater {
  fetchNotifications (): Promise<number>

  digest (): Promise<void>
}
