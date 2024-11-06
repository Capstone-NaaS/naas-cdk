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

export const handler: Handler = async (log: NotificationLogType) => {
  const { log_id, channel, ttl, ...notification } = log;
  const user_id = notification.user_id;

  const getCommand = new GetCommand({
    TableName: process.env.USER_PREFERENCES_TABLE,
    Key: { user_id },
    ProjectionExpression: "in_app",
  });
  const response = await docClient.send(getCommand);
  const inAppPref = response.Item?.in_app;

  try {
    const saveNotifParams = {
      TableName: process.env.ACTIVE_NOTIF_TABLE,
      Item: {
        ...notification,
        created_at: new Date(notification.created_at).toISOString(),
        status: "unread",
      },
    };

    if (inAppPref) {
      // Save received notification to table of active notifications
      const saveNotifCommand = new PutCommand(saveNotifParams);
      const dbResponse = await docClient.send(saveNotifCommand);
    }

    // broadcast to connected client
    // this next lambda determines whether the user is currently connected
    const lambdaCommand = new InvokeCommand({
      FunctionName: process.env.WS_BROADCAST_LAMBDA,
      InvocationType: "Event",
      Payload: JSON.stringify({
        user_id,
        notification: saveNotifParams.Item,
      }),
    });

    const lambdaResponse = await lambdaClient.send(lambdaCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: lambdaResponse }),
    };
  } catch (error) {
    console.error("Error saving notification:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error }),
    };
  }
};
