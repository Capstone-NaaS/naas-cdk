import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Handler } from "aws-lambda";

const lambdaClient = new LambdaClient();
const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

async function sendNotification(log: NotificationLog, functionName: string) {
  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(log),
    });
    const response = await lambdaClient.send(command);
    return "Notification event sent to be broadcasted";
  } catch (error) {
    console.log("Error invoking the Lambda function: ", error);
    return error;
  }
}

interface NotificationLog {
  log_id: string;
  notification_id: string;
  user_id: string;
  created_at: string;
  status: string | undefined; //notification created, notification sent, notification recieved
  channel: string; // in-app, email, slack
  message: string;
}

function createLog(
  status: string,
  user_id: string,
  message: string,
  channel: string,
  notification_id: string
): NotificationLog {
  // on POST request create a base log object
  if (!notification_id) {
    notification_id = randomUUID();
  }

  return {
    log_id: randomUUID(),
    notification_id,
    user_id,
    created_at: new Date().toUTCString(),
    status: status && "notification request received", //notification created, notification sent, notification recieved
    channel, // in-app, email, slack
    message,
  };
}

async function addLog(log: NotificationLog) {
  const params = {
    TableName: process.env.NOTIFICATION_LOG_TABLE,
    Item: log,
  };

  try {
    const data = await docClient.send(new PutCommand(params));
    console.log("result : " + JSON.stringify(data));
  } catch (error) {
    console.error("Error:", error);
  }
}

export const handler: Handler = async (event) => {
  const requestMethod = event.requestContext.http.method;

  if (requestMethod === '"GET"') {
    // get all logs from Dynamo
  } else if (requestMethod === '"POST"') {
    const body = JSON.parse(event.body);
    // request to preferenced DB for preferences, hard-coded for now

    const log = createLog(
      body.status,
      body.user_id,
      body.message,
      "in-app",
      body.notification_id
    );
    await addLog(log);

    // if initial post request
    if (!body.status) {
      const functionName = process.env.SEND_NOTIFICATION!;
      await sendNotification(log, functionName);
    }
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("Dynamo Lambda executed successfully"),
  };

  return response;
};
