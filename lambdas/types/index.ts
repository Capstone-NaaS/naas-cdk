export interface NotificationType {
  notification_id: string;
  user_id: string;
  message: string;
  created_at: string;
  status: string;
}

export interface UpdatedNotificationType {
  notification_id: string;
  userHash: string;
  status: string;
}
