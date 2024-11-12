import { StreamProcessingStartSelector } from "aws-sdk/clients/rekognition";

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
  status?: string; //notification created, notification sent, notification recieved
  channel: string; // in-app, email, slack
  message: string;
  receiver_email?: string;
  subject?: string;
  ttl: number;
}

export interface InAppLog {
  status?: string;
  notification_id: string;
  user_id: string;
  channel: "in-app";
  body: {
    message: string;
  };
}

export interface EmailLog {
  status?: string;
  notification_id: string;
  user_id: string;
  channel: "email";
  body: {
    message: string;
    subject: string;
    receiver_email: string;
  };
}
