export interface INotification {
  msg: string
}

export interface INotificationRecord extends INotification {
  sender: string
  receiver: string
}

export interface IPrivateNotification extends INotification {
  private: true
  keys: string
}
