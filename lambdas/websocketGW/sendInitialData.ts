import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { InAppLog, NotificationType } from "../types";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient();

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

// look up connection ID
async function getConnectionId(user_id: string) {
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

  return queryConnIdResult.Items && queryConnIdResult.Items.length > 0
    ? queryConnIdResult.Items[0].connectionId
    : null;
}

// send log message to queue
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

// look up active notifications
async function getActiveNotifications(user_id: string) {
  const queryParams: QueryCommandInput = {
    TableName: process.env.ACTIVE_NOTIF_TABLE,
    KeyConditionExpression: "user_id = :user_id",
    ExpressionAttributeValues: {
      ":user_id": user_id,
    },
    ScanIndexForward: false,
  };
  const queryNotifCommand = new QueryCommand(queryParams);
  const queryNotifResult = await docClient.send(queryNotifCommand);
  return queryNotifResult;
}

export const handler: Handler = async (event) => {
  const { user_id } = JSON.parse(event.body).payload;
  if (user_id === "ping") {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "pong" }),
    };
  }

  try {
    // query user preferences table to see if user wants to receive in_app notifiations
    const getCommand = new GetCommand({
      TableName: process.env.USER_PREFERENCES_TABLE,
      Key: { user_id },
    });
    const response = await docClient.send(getCommand);
    const preference = response.Item;
    delete preference?.user_id;

    const activeNotifs = await getActiveNotifications(user_id);
    const connectionId = await getConnectionId(user_id);

    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        topic: "initial_data",
        notifications: activeNotifs?.Items,
        preference,
      }),
    });

    const items = (activeNotifs.Items as NotificationType[]) || [];

    for (let ind = 0; ind < items.length; ind += 1) {
      const item = items[ind];
      if (!item.delivered) {
        // update active notification status
        const updateCommand = new UpdateCommand({
          TableName: process.env.ACTIVE_NOTIF_TABLE,
          Key: {
            user_id: item.user_id,
            created_at: item.created_at,
          },
          UpdateExpression: "SET delivered = :newValue",
          ExpressionAttributeValues: {
            ":newValue": true,
          },
        });

        await docClient.send(updateCommand);

        const sentLog: InAppLog = {
          status: "In-app notification sent.",
          notification_id: item.notification_id,
          user_id,
          channel: "in_app",
          body: {
            message: item.message,
          },
        };

        await sendLog(sentLog);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Messages sent to the user" }),
    };
  } catch (error) {
    console.error("Error broadcasting message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to broadcast message" }),
    };
  }
};
