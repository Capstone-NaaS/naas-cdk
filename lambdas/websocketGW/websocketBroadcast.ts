import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

import { NotificationType } from "../types";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

const CONNECTION_TABLE = process.env.CONNECTION_TABLE;

interface NotificationsType {
  user_id: string;
  connectionId?: string;
  notifications: NotificationType[];
}

export const handler: Handler = async (event: NotificationsType) => {
  // receive array of notifications
  let { user_id, notifications, connectionId } = event;

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
    if (connectionId === undefined) {
      // Scan the DynamoDB table to get the connection ID of the provided user ID
      const queryConnIdParams: QueryCommandInput = {
        TableName: CONNECTION_TABLE,
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
        Data: JSON.stringify({ topic: "notification", notifications }),
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
