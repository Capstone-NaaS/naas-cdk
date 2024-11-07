import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Handler } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { NotificationLogType } from "../types";

const lambdaClient = new LambdaClient();
const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

// pass notification to lambda for  in-app notification
async function sendNotification(log: NotificationLogType) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.SEND_NOTIFICATION,
      InvocationType: "Event",
      Payload: JSON.stringify(log),
    });
    const response = await lambdaClient.send(command);
    return "Notification event sent to be broadcasted";
  } catch (error) {
    console.log("Error invoking the Lambda function: ", error);
    return error;
  }
}

// pass notification to lambda for email notification
async function emailNotification(log: NotificationLogType) {
  try {
    const command = new InvokeCommand({
      FunctionName: process.env.EMAIL_NOTIFICATION,
      InvocationType: "Event",
      Payload: JSON.stringify(log),
    });
    const response = await lambdaClient.send(command);
    return "Notification event sent to be emailed";
  } catch (error) {
    console.log("Error invoking the email Lambda function: ", error);
    return error;
  }
}

function createLog(
  status: string,
  user_id: string,
  message: string,
  channel: string,
  notification_id: string
): NotificationLogType {
  if (!notification_id) {
    notification_id = randomUUID();
  }

  const expirationTime = Math.floor(Date.now() / 1000) + 2592000; // 30 days from now in Unix epoch

  return {
    log_id: randomUUID(),
    notification_id,
    user_id,
    created_at: new Date().toISOString(),
    status: status || "notification request received", //notification created, notification sent, notification recieved
    channel, // in-app, email, slack
    message,
    ttl: expirationTime,
  };
}

async function addLog(log: NotificationLogType) {
  const params = {
    TableName: process.env.NOTIFICATION_LOG_TABLE,
    Item: log,
  };

  try {
    const data = await docClient.send(new PutCommand(params));
    console.log("result : " + JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error:", error);
    return error;
  }
}

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

async function getLog(userId: string, createdAt: string) {
  const params = {
    TableName: process.env.NOTIFICATION_LOG_TABLE,
    Key: {
      // use partition key and sort key in query
      user_id: userId,
      created_at: createdAt,
    },
  };

  const result = await dbClient.send(new GetCommand(params));
  return result.Item;
}

export const handler: Handler = async (event) => {
  const requestMethod = event.requestContext.http.method;
  let responseData;
  let notificationsLogged;

  if (requestMethod === "GET") {
    responseData = await getLogs();
  } else if (requestMethod === "POST") {
    const body = JSON.parse(event.body);
    // if this is the initial notification request:
    if (!body.status) {
      const CHANNELS = ["in-app", "email"];

      // for each channel, create a log and send to notification_logs db
      notificationsLogged = await Promise.all(
        CHANNELS.map(async (channel) => {
          const log = createLog(
            body.status,
            body.user_id,
            body.message,
            `${channel}`,
            body.notification_id
          );
          const addedLog = await addLog(log);
          if (!addedLog) {
            console.error(`Failed to add log for channel: ${channel}`);
            return null; // Indicate failure
          } else {
            console.log(
              `Successfully added log for channel ${channel}:`,
              addedLog
            );
          }

          // send to a lambda depending on the channel
          if (channel === "in-app") {
            await sendNotification(log);
          } else if (channel === "email") {
            await emailNotification(log);
          }

          // for each channel, return log info
          const response = await getLog(log.user_id, log.created_at);
          return response;
        })
      );
    } else {
      // if this is for an updated log:
      const log = createLog(
        body.status,
        body.user_id,
        body.message,
        body.channel,
        body.notification_id
      );
      await addLog(log);
    }
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify(responseData || notificationsLogged),
  };

  return response;
};
