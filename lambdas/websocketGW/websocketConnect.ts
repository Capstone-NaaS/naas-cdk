import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const CONNECTION_TABLE = process.env.CONNECTION_TABLE!;

const updateLastSeen = async (user_id: string) => {
  const params: UpdateCommandInput = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    Key: {
      id: user_id,
    },
    UpdateExpression: "SET #attrName = :attrValue",
    ExpressionAttributeNames: {
      "#attrName": "last_seen",
    },
    ExpressionAttributeValues: {
      ":attrValue": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    const data = await docClient.send(new UpdateCommand(params));
    console.log("Update succeeded:", data);
  } catch (error) {
    console.error("Update failed:", error);
  }
};

export const handler: Handler = async (event) => {
  const user_id = event.queryStringParameters.user_id;
  const connectionId = event.requestContext.connectionId;

  if (!user_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "User ID is missing" }),
    };
  }

  try {
    await updateLastSeen(user_id);
  } catch (error) {
    console.error("Error updating last seen:", error);
  }

  try {
    // add connection ID to db
    const putParams: PutCommandInput = {
      TableName: CONNECTION_TABLE,
      Item: {
        connectionId,
        user_id,
      },
    };
    const putCommand = new PutCommand(putParams);
    await docClient.send(putCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Connected", connectionId, event }),
    };
  } catch (error) {
    console.error("Error saving connection ID:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to connect" }),
    };
  }
};
