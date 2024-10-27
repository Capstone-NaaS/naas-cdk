import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  PutCommand,
  PutCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient();

const CONNECTION_TABLE = process.env.CONNECTION_TABLE!;
const ACTIVE_NOTIF_TABLE = process.env.ACTIVE_NOTIF_TABLE!;
const WS_BROADCAST_LAMBDA = process.env.WS_BROADCAST_LAMBDA!;

// look up active notifications
async function getActiveNotifications(user_id: string) {
  const queryParams: QueryCommandInput = {
    TableName: ACTIVE_NOTIF_TABLE,
    KeyConditionExpression: "user_id = :user_id",
    ExpressionAttributeValues: {
      ":user_id": user_id,
    },
    ScanIndexForward: false,
  };
  const queryNotifCommand = new QueryCommand(queryParams);
  const queryNotifResult = await docClient.send(queryNotifCommand);
  return queryNotifResult;
}

// send to websocketBroadcast

export const handler: Handler = async (event) => {
  const user_id = event.queryStringParameters.user_id;
  const connectionId = event.requestContext.connectionId;

  if (!connectionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Connection ID is missing" }),
    };
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

    // see if there are any active notifications to send out
    const activeNotifs = await getActiveNotifications(user_id);

    if (activeNotifs.Items!.length > 0) {
      const lambdaCommand = new InvokeCommand({
        FunctionName: WS_BROADCAST_LAMBDA,
        InvocationType: "Event",
        Payload: JSON.stringify({
          user_id,
          notifications: activeNotifs.Items,
        }),
      });

      await lambdaClient.send(lambdaCommand);
    }

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
