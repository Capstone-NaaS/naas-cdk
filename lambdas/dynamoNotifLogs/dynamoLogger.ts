import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from "aws-lambda";

import { NotificationLogType } from "../types";

const lambdaClient = new LambdaClient();
const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

async function getUserPreference(user_id: string, channel: string) {
  const getCommand = new GetCommand({
    TableName: process.env.USER_PREFERENCES_TABLE,
    Key: { user_id },
    ProjectionExpression: channel,
  });
  const response = await docClient.send(getCommand);
  return response.Item![channel];
}

// pass notification to lambda for in_app notification
async function inAppNotification(log: NotificationLogType) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.SEND_NOTIFICATION,
      InvocationType: "Event",
      Payload: JSON.stringify(log),
    });
    const response = await lambdaClient.send(command);
    return "Notification event sent to be broadcasted";
  } catch (error) {
    console.log("Error invoking the Lambda function: ", error);
    return error;
  }
}

// pass notification to lambda for email notification
async function emailNotification(log: NotificationLogType) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.EMAIL_NOTIFICATION,
      InvocationType: "Event",
      Payload: JSON.stringify(log),
    });
    const response = await lambdaClient.send(command);
    return "Notification event sent to be emailed";
  } catch (error) {
    console.log("Error invoking the email Lambda function: ", error);
    return error;
  }
}

function createLog(
  status: string,
  user_id: string,
  message: string,
  channel: string,
  notification_id: string,
  receiver_email?: string,
  subject?: string
): NotificationLogType {
  if (!notification_id) {
    notification_id = randomUUID();
  }

  const expirationTime = Math.floor(Date.now() / 1000) + 2592000; // 30 days from now in Unix epoch
  const log: NotificationLogType = {
    log_id: randomUUID(),
    created_at: new Date().toISOString(),
    ttl: expirationTime,
    user_id,
    status, //notification created, notification sent, notification recieved
    message,
    channel, // in_app, email, slack
    notification_id,
  };

  if (channel === "email") {
    log.receiver_email = receiver_email;
    log.subject = subject;
  }

  return log;
}

async function addLog(log: NotificationLogType) {
  const params = {
    TableName: process.env.NOTIFICATION_LOG_TABLE,
    Item: log,
  };

  try {
    const data = await docClient.send(new PutCommand(params));
    console.log("result : " + JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error:", error);
    return error;
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (let record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const log: NotificationLogType = createLog(
        body.status ? body.status : "Notification request received.",
        body.user_id,
        body.body.message,
        body.channel,
        body.notification_id,
        body.body.receiver_email,
        body.body.subject
      );
      await addLog(log);

      if (!body.status) {
        const preference = await getUserPreference(body.user_id, body.channel);
        if (preference && body.channel === "in_app") {
          await inAppNotification(log);
        } else if (preference && body.channel === "email") {
          await emailNotification(log);
        } else if (!preference) {
          const log: NotificationLogType = createLog(
            "Notification not sent - channel disabled by user.",
            body.user_id,
            body.body.message,
            body.channel,
            body.notification_id,
            body.body.receiver_email,
            body.body.subject
          );
          await addLog(log);
        }
      }
    } catch (error) {
      console.error(error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
