import { Handler } from "aws-lambda";
import * as AWS from "aws-sdk";

const DynamoDB = AWS.DynamoDB;
const ApiGatewayManagementApi = AWS.ApiGatewayManagementApi;

const dynamoDb = new DynamoDB.DocumentClient();
const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: Handler = async (event) => {
  const message: string = JSON.parse(event.body).message;
  const id: string = JSON.parse(event.body).id;

  if (!message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Message is required" }),
    };
  }

  try {
    // Scan the DynamoDB table to get all connection IDs
    const scanParams = {
      TableName: TABLE_NAME,
    };

    const scanResult = await dynamoDb.scan(scanParams).promise();
    const connectionIds = scanResult.Items!.map((item) => item.connectionId);

    // Send the message to each connection
    await Promise.all(
      connectionIds.map((connectionId) => {
        return apiGateway
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({ id, message }),
          })
          .promise();
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message sent to all connections" }),
    };
  } catch (error) {
    console.error("Error broadcasting message:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to broadcast message" }),
    };
  }
};
