import { Handler } from "aws-lambda";
import * as AWS from "aws-sdk";
import { AttributeValue, DeleteItemInput } from "aws-sdk/clients/dynamodb";

const DynamoDB = AWS.DynamoDB;

const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: Handler = async (event) => {
  const connectionId: AttributeValue = event.requestContext.connectionId;

  if (!connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Connection ID is missing" }),
    };
  }

  const params: DeleteItemInput = {
    TableName: TABLE_NAME,
    Key: {
      connectionId: connectionId,
    },
  };

  try {
    await dynamoDb.delete(params).promise();
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
