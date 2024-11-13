import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { Handler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dbClient = new DynamoDBClient({});

async function getLogs() {
  const params = {
    TableName: process.env.NOTIFICATION_LOG_TABLE,
  };

  try {
    const data = await dbClient.send(new ScanCommand(params));

    if (!data.Items) {
      return [];
    }
    return data.Items.map((item) => unmarshall(item));
  } catch (error) {
    console.error(error);
    return error;
  }
}

export const handler: Handler = async (event) => {
  const responseData = await getLogs();

  const response = {
    statusCode: 200,
    body: JSON.stringify(responseData),
  };

  return response;
};
