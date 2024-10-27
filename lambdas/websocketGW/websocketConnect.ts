import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  AttributeValue,
  DynamoDB,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { Handler } from "aws-lambda";

const dynamoDb = DynamoDBDocument.from(new DynamoDB());
const TABLE_NAME: string = process.env.TABLE_NAME!;

export const handler: Handler = async (event) => {
  const connectionId: AttributeValue = event.requestContext.connectionId;

  if (!connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Connection ID is missing" }),
    };
  }

  const params: PutItemCommandInput = {
    TableName: TABLE_NAME,
    Item: {
      connectionId: connectionId,
    },
  };

  try {
    await dynamoDb.put(params);
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
