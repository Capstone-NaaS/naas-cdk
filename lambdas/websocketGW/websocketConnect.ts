import * as AWS from "aws-sdk";
import { Handler } from "aws-lambda";
import { AttributeValue, PutItemInput } from "aws-sdk/clients/dynamodb";

const DynamoDB = AWS.DynamoDB;

const dynamoDb = new DynamoDB.DocumentClient();
const TABLE_NAME: string = process.env.TABLE_NAME!;

export const handler: Handler = async (event) => {
  const connectionId: AttributeValue = event.requestContext.connectionId;

  if (!connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Connection ID is missing" }),
    };
  }

  const params: PutItemInput = {
    TableName: TABLE_NAME,
    Item: {
      connectionId: connectionId,
    },
  };

  try {
    await dynamoDb.put(params).promise();
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
