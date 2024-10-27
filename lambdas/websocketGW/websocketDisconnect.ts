import { Handler } from "aws-lambda";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  AttributeValue,
  DeleteItemCommandInput,
  DynamoDB,
} from "@aws-sdk/client-dynamodb";

const dynamoDb = DynamoDBDocument.from(new DynamoDB());
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: Handler = async (event) => {
  const connectionId: AttributeValue = event.requestContext.connectionId;

  if (!connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Connection ID is missing" }),
    };
  }

  const params: DeleteItemCommandInput = {
    TableName: TABLE_NAME,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    await dynamoDb.delete(params);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Disconnected", connectionId }),
    };
  } catch (error) {
    console.error("Error removing connection ID:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to disconnect" }),
    };
  }
};
