import { Handler } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

<<<<<<< Updated upstream
import { NotificationLogType } from "../types";
=======
<<<<<<< Updated upstream
import { NotificationType } from "../types";
=======
import { LogEvent, NotificationLogType } from "../types";
>>>>>>> Stashed changes
>>>>>>> Stashed changes

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient();

const ACTIVE_NOTIF_TABLE = process.env.ACTIVE_NOTIF_TABLE;
const WS_BROADCAST_LAMBDA = process.env.WS_BROADCAST_LAMBDA;

<<<<<<< Updated upstream
export const handler: Handler = async (log: NotificationLogType) => {
  const { log_id, channel, ttl, ...notification } = log;
  // const notification: NotificationType = ;
=======
<<<<<<< Updated upstream
export const handler: Handler = async (body) => {
  const notification: NotificationType = body;
=======
async function sendLog(logEvent: LogEvent) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.DYNAMO_LOGGER_FN,
      InvocationType: "Event",
      Payload: JSON.stringify(logEvent),
    });
    const response = await lambdaClient.send(command);
    return "Log sent to the dynamo logger";
  } catch (error) {
    console.log("Error invoking the Lambda function: ", error);
    return error;
  }
}

export const handler: Handler = async (log: NotificationLogType) => {
  const { log_id, channel, ttl, ...notification } = log;
  // const notification: NotificationType = ;
>>>>>>> Stashed changes
>>>>>>> Stashed changes
  const user_id = notification.user_id;

  // query user preferences table to see if user wants to receive in-app notifiations
  const getCommand = new GetCommand({
    TableName: process.env.USER_PREFERENCES_TABLE,
    Key: { user_id },
    ProjectionExpression: "in_app",
  });
  const response = await docClient.send(getCommand);
  const inAppPref = response.Item?.in_app;
  if (!inAppPref) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User preference turned off." }),
    };
  }

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

    // add log to indicate we added this to list of active notifications
    const body = {
      status: "notification queued",
      user_id,
      message: notification.message,
      notification_id: notification.notification_id,
    };

    const log = {
      requestContext: {
        http: {
          method: "POST",
        },
      },
      body: JSON.stringify(body),
    };

    await sendLog(log);

    // broadcast to connected client
    // this next lambda determines whether the user is currently connected
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
