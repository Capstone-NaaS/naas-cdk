import { Handler } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

import { NotificationType } from "../types";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

const CONNECTION_ID_TABLE = process.env.TABLE_NAME;

interface NotificationsType {
  user_id: string;
  notifications: NotificationType[];
}
export const handler: Handler = async (event) => {
  // receive array of notifications
  const notifications: NotificationsType = event;

  const user_id = notifications.user_id;

  try {
    // Scan the DynamoDB table to get the connection ID of the provided user ID
    const queryConnIdParams = {
      TableName: CONNECTION_ID_TABLE,
      IndexName: "user_id-index",
      KeyConditionExpression: "user_id = :user_id",
      ExpressionAttributeValues: {
        ":user_id": user_id,
      },
      Limit: 1,
    };

    const queryConnIdCommand = new QueryCommand(queryConnIdParams);
    const queryConnIdResult = await docClient.send(queryConnIdCommand);

    const connectionId =
      queryConnIdResult.Items && queryConnIdResult.Items.length > 0
        ? queryConnIdResult.Items[0].connectionId
        : null;

    if (connectionId) {
      const parsedNotifications = notifications.notifications.map(
        (notification) => {
          const { ["user_id"]: remove, ...note } = notification;
          return note;
        }
      );

      await apiGateway.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify(parsedNotifications),
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Message sent to the user" }),
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
