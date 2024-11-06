import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

import { LogEvent, NotificationType } from "../types";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const lambdaClient = new LambdaClient();

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

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

interface EventType {
  user_id: string;
  connectionId?: string;
  notification: NotificationType;
}

export const handler: Handler = async (event: EventType) => {
  // receive array of notifications
  let { user_id, notification, connectionId } = event;

  // add log to indicate we added this to list of active notifications
  const body = {
    status: "notification queued",
    user_id,
    message: notification.message,
    notification_id: notification.notification_id,
    channel: "in-app",
  };

  // query user preferences table to see if user wants to receive in-app notifiations
  const getCommand = new GetCommand({
    TableName: process.env.USER_PREFERENCES_TABLE,
    Key: { user_id },
    ProjectionExpression: "in_app",
  });
  const response = await docClient.send(getCommand);
  const inAppPref = response.Item?.in_app;
  if (!inAppPref) {
    body.status = "Not sent. User pref turned off.";

    const log = {
      requestContext: {
        http: {
          method: "POST",
        },
      },
      body: JSON.stringify(body),
    };

    await sendLog(log);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User preference turned off." }),
    };
  }

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

    body.status = "Notification queued.";

    const log = {
      requestContext: {
        http: {
          method: "POST",
        },
      },
      body: JSON.stringify(body),
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
