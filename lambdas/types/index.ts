export interface NotificationType {
  notification_id: string;
  user_id: string;
  message: string;
  created_at: string;
  status: string;
}

export interface UpdatedNotificationType {
  notification_id: string;
  user_id: string;
  status: string;
}

export interface NotificationLogType {
  log_id: string;
  notification_id: string;
  user_id: string;
  created_at: string;
  status: string | undefined; //notification created, notification sent, notification recieved
  channel: string; // in-app, email, slack
  message: string;
}

export interface LogEvent {
  requestContext: {
    http: {
      method: string;
    };
  };
  body: string;
}
