import { APIGatewayEvent, Context } from "aws-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event: APIGatewayEvent, context: Context) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body || "{}");
  const userHash = body.userHash;

  if (!connectionId || !userHash) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing connectionId or userHash" }),
    };
  }

  try {
    const updateParams = {
      TableName: TABLE_NAME,
      Key: {
        connectionId: connectionId,
      },
      UpdateExpression: "SET user_id = :userHash",
      ExpressionAttributeValues: {
        ":userHash": userHash,
      },
    };

    const updateCommand = new UpdateCommand(updateParams);
    await docClient.send(updateCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Connection user updated successfully" }),
    };
  } catch (error) {
    console.error("Error updating userHash:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to update userHash" }),
    };
  }
};
