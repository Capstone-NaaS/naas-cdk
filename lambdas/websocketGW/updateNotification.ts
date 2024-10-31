import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { UpdatedNotificationType, LogEvent } from "../types";

const lambdaClient = new LambdaClient();
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

async function sendLog(logEvent: LogEvent) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.DYNAMO_LOGGER_FN,
      InvocationType: "Event",
      Payload: JSON.stringify(logEvent),
    });
    const response = await lambdaClient.send(command);
    return "Log sent to the dynamo logger";
  } catch (error) {
    console.log("Error invoking the Lambda function: ", error);
    return error;
  }
}

export const handler: Handler = async (event) => {
  const payload: UpdatedNotificationType = JSON.parse(event.body).payload;
  const { notification_id, user_id, status } = payload;

  // find the notification in the active notifications table
  const queryParams = {
    TableName: process.env.ACTIVE_NOTIF_TABLE,
    IndexName: "notification_id-index",
    KeyConditionExpression: "notification_id = :notification_id",
    ExpressionAttributeValues: {
      ":notification_id": notification_id,
    },
    Limit: 1,
  };

  const queryCommand = new QueryCommand(queryParams);
  const queryResult = await docClient.send(queryCommand);
  const items = queryResult.Items ?? [];

  if (items.length > 0) {
    // if notification is found
    const item = items[0];
    const { created_at, message } = item;

    let response, result;

    switch (status) {
      case "read":
        // update the notification status to read
        const updateParams = {
          TableName: process.env.ACTIVE_NOTIF_TABLE,
          Key: {
            user_id,
            created_at: created_at,
          },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": "read",
          },
        };

        const updateCommand = new UpdateCommand(updateParams);
        result = await docClient.send(updateCommand);

        response = {
          statusCode: 200,
          body: JSON.stringify(result),
        };

        break;
      case "delete":
        // delete the notification from the active notifications table
        const deleteParams = {
          TableName: process.env.ACTIVE_NOTIF_TABLE,
          Key: {
            user_id,
            created_at: created_at,
          },
        };

        const deleteCommand = new DeleteCommand(deleteParams);
        result = await docClient.send(deleteCommand);

        response = {
          statusCode: 200,
          body: JSON.stringify(result),
        };

        break;
      default:
        response = {
          statusCode: 400,
          body: JSON.stringify("Invalid status."),
        };
        break;
    }

    const body = {
      status,
      user_id,
      message,
      notification_id,
    };

    const log = {
      requestContext: {
        http: {
          method: "POST",
        },
      },
      body: JSON.stringify(body),
    };

    await sendLog(log);

    return response;
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify("Notification not found"),
    };
  }
};
