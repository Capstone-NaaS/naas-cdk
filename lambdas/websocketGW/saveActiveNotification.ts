import { Handler } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { NotificationType } from "../types";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient();

const ACTIVE_NOTIF_TABLE = process.env.ACTIVE_NOTIF_TABLE;
const WS_BROADCAST_LAMBDA = process.env.WS_BROADCAST_LAMBDA;

export const handler: Handler = async (body) => {
  const notification: NotificationType = body;
  const user_id = notification.user_id;

  try {
    // Save received notification to table of active notifications
    const saveNotifParams = {
      TableName: ACTIVE_NOTIF_TABLE,
      Item: {
        ...notification,
        created_at: new Date().toUTCString(),
        status: "unread",
      },
    };

    const saveNotifCommand = new PutCommand(saveNotifParams);
    const dbResponse = await docClient.send(saveNotifCommand);

    const lambdaCommand = new InvokeCommand({
      FunctionName: WS_BROADCAST_LAMBDA,
      InvocationType: "Event",
      Payload: JSON.stringify({
        user_id,
        notifications: [saveNotifParams.Item],
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
