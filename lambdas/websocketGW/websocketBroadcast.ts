import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
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
    QueueUrl: "https://sqs.us-west-1.amazonaws.com/412381737648/ProcessQueue",
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

    const log: InAppLog = {
      status: "Notification queued for sending.",
      notification_id: notification.notification_id,
      user_id,
      channel: "in-app",
      body: {
        message: notification.message,
      },
    };

    await sendLog(log);

    if (connectionId) {
      await apiGateway.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          topic: "notification",
          notifications: [notification],
        }),
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Messages sent to the user" }),
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "User currently not connected" }),
      };
    }
  } catch (error) {
    console.error("Error broadcasting message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to broadcast message" }),
    };
  }
};
