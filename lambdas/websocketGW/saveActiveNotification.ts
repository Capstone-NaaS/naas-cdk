import { Handler } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { NotificationLogType } from "../types";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient();

const ACTIVE_NOTIF_TABLE = process.env.ACTIVE_NOTIF_TABLE;
const WS_BROADCAST_LAMBDA = process.env.WS_BROADCAST_LAMBDA;

export const handler: Handler = async (log: NotificationLogType) => {
  const { log_id, channel, ttl, ...notification } = log;
  const user_id = notification.user_id;

  try {
    // Save received notification to table of active notifications
    const saveNotifParams = {
      TableName: ACTIVE_NOTIF_TABLE,
      Item: {
        ...notification,
        created_at: new Date(notification.created_at).toISOString(),
        status: "unread",
      },
    };

    const saveNotifCommand = new PutCommand(saveNotifParams);
    const dbResponse = await docClient.send(saveNotifCommand);

    // broadcast to connected client
    // this next lambda determines whether the user is currently connected
    const lambdaCommand = new InvokeCommand({
      FunctionName: WS_BROADCAST_LAMBDA,
      InvocationType: "Event",
      Payload: JSON.stringify({
        user_id,
        notification: saveNotifParams.Item,
      }),
    });

    await lambdaClient.send(lambdaCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: dbResponse }),
    };
  } catch (error) {
    console.error("Error saving notification:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error }),
    };
  }
};
