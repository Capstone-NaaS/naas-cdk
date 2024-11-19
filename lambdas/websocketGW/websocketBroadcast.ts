import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import { InAppLog, NotificationType } from "../types";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient();

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

async function sendLog(log: InAppLog) {
  // push to queue
  const queueParams: {
    QueueUrl: string;
    MessageBody: string;
  } = {
    QueueUrl: process.env.LOG_QUEUE!,
    MessageBody: JSON.stringify(log),
  };

  const command = new SendMessageCommand(queueParams);
  return await sqs.send(command);
}

interface EventType {
  user_id: string;
  connectionId?: string;
  notification: NotificationType;
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

export const handler: Handler = async (event: EventType) => {
  // receive array of notifications
  let { user_id, notification, connectionId } = event;

  try {
    if (connectionId === undefined) {
      // Scan the DynamoDB table to get the connection ID of the provided user ID
      const queryConnIdParams: QueryCommandInput = {
        TableName: process.env.CONNECTION_TABLE,
        IndexName: "user_id-index",
        KeyConditionExpression: "user_id = :user_id",
        ExpressionAttributeValues: {
          ":user_id": user_id,
        },
        Limit: 1,
      };
      const queryConnIdCommand = new QueryCommand(queryConnIdParams);
      const queryConnIdResult = await docClient.send(queryConnIdCommand);

      connectionId =
        queryConnIdResult.Items && queryConnIdResult.Items.length > 0
          ? queryConnIdResult.Items[0].connectionId
          : null;
    }

    if (connectionId) {
      await apiGateway.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          topic: "notification",
          notifications: [notification],
        }),
      });

      await updateLastNotified(user_id);

      // add log for notification being sent
      const sentLog: InAppLog = {
        status: "Notification sent.",
        notification_id: notification.notification_id,
        user_id,
        channel: "in_app",
        body: {
          message: notification.message,
        },
      };

      await sendLog(sentLog);

      // update active notification status
      const updateCommand = new UpdateCommand({
        TableName: process.env.ACTIVE_NOTIF_TABLE,
        Key: {
          user_id: notification.user_id,
          created_at: notification.created_at,
        },
        UpdateExpression: "SET delivered = :newValue",
        ExpressionAttributeValues: {
          ":newValue": true,
        },
      });

      await docClient.send(updateCommand);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Messages sent to the user" }),
      };
    } else {
      const queuedLog: InAppLog = {
        status: "Notification queued for sending.",
        notification_id: notification.notification_id,
        user_id,
        channel: "in_app",
        body: {
          message: notification.message,
        },
      };

      await sendLog(queuedLog);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "User currently not connected" }),
      };
    }
  } catch (error) {
    const log: InAppLog = {
      status: "In-app notification unable to be broadcast.",
      notification_id: notification.notification_id,
      user_id,
      channel: "in_app",
      body: {
        message: notification.message,
      },
    };
    await sendLog(log);
    console.error("Error broadcasting message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to broadcast message" }),
    };
  }
};
