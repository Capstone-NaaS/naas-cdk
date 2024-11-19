import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SlackLog, NotificationLogType } from "../types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient();

async function sendLog(log: SlackLog) {
  // push to queue
  const queueParams = {
    QueueUrl: process.env.LOG_QUEUE,
    MessageBody: JSON.stringify(log),
  };

  const command = new SendMessageCommand(queueParams);
  const sqsResponse = await sqs.send(command);
  return;
}

async function updateLastNotified(user_id: string) {
  const params: UpdateCommandInput = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    Key: {
      id: user_id,
    },
    UpdateExpression: "SET #attrName = :attrValue",
    ExpressionAttributeNames: {
      "#attrName": "last_notified",
    },
    ExpressionAttributeValues: {
      ":attrValue": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    const data = await docClient.send(new UpdateCommand(params));
    console.log("Update succeeded:", data);
  } catch (error) {
    console.error("Update failed:", error);
  }
}

export const handler: Handler = async (log: NotificationLogType) => {
  try {
    const response = await fetch(log.slack!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: log.message,
      }),
    });

    if (response.status === 200) {
      const newLog: SlackLog = {
        status: "Slack notification sent.",
        notification_id: log.notification_id,
        user_id: log.user_id,
        channel: "slack",
        body: {
          slack: log.slack!,
          message: log.message,
        },
      };

      await sendLog(newLog);
      await updateLastNotified(log.user_id);
    } else {
      const newLog: SlackLog = {
        status: "Slack notification could not be sent.",
        notification_id: log.notification_id,
        user_id: log.user_id,
        channel: "slack",
        body: {
          slack: log.slack!,
          message: log.message,
        },
      };

      await sendLog(newLog);
    }
  } catch (error) {
    const newLog: SlackLog = {
      status: "Error sending Slack notification.",
      notification_id: log.notification_id,
      user_id: log.user_id,
      channel: "slack",
      body: {
        slack: log.slack!,
        message: log.message,
      },
    };

    await sendLog(newLog);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("Slack notification processed successfully"),
  };

  return response;
};
