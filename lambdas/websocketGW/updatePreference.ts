import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import { Handler } from "aws-lambda";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

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

export const handler: Handler = async (event) => {
  const payload = JSON.parse(event.body).payload;
  try {
    const putCommand = new PutCommand({
      TableName: process.env.USER_PREFERENCES_TABLE,
      Item: payload,
    });
    const response = await docClient.send(putCommand);

    if (response.$metadata.httpStatusCode === 200) {
      const connectionId = await getConnectionId(payload.user_id);

      await apiGateway.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          topic: "preference",
          preference: payload,
        }),
      });
    } else {
      throw new Error("Error updating preference in DynamoDB.");
    }
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error updating user preferences: ", error);
    if (error instanceof Error) {
      return {
        statusCode: 500,
        body: error.message,
      };
    } else {
      return {
        statusCode: 500,
        body: "Error updating user preferences",
      };
    }
  }
};
