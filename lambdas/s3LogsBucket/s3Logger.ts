import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const websocketBroadcastArn = process.env.WEBSOCKET_BROADCAST_ARN; // can just be name, does not have to be arn
const client = new LambdaClient();

async function sendNotification(payload) {
  try {
    const params = {
      FunctionName: websocketBroadcastArn,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    };

    const command = new InvokeCommand(params);
    const response = await client.send(command);
    return "Notification event sent to be broadcasted";
  } catch (error) {
    return "Error invoking the Lambda function: ", error;
  }
}

export const handler = async (event) => {
  const s3 = new S3Client();
  const BUCKET_NAME = "notification-logs-test-f";
  const requestType = JSON.stringify(event.requestContext.http.method);

  let res;

  if (requestType === '"GET"') {
    const retrieveLogsFromBucket = async () => {
      const { Contents } = await s3.send(
        new ListObjectsCommand({ Bucket: BUCKET_NAME })
      );
      let logs = [];
      if (Contents) {
        try {
          for (const content of Contents) {
            const obj = await s3.send(
              new GetObjectCommand({ Bucket: BUCKET_NAME, Key: content.Key })
            );

            if (obj.Body) {
              const logString = await obj.Body.transformToString();
              logs.push(JSON.parse(logString));
            }
          }
        } catch (error) {
          return "Error retrieving objects from S3:", error;
        }
      }
      return logs;
    };
    res = await retrieveLogsFromBucket();
  } else if (requestType === '"POST"') {
    const uploadLogToBucket = async (logData) => {
      const putNotificationLog = {
        Body: JSON.stringify({ msg: logData }),
        Bucket: BUCKET_NAME,
        Key: crypto.randomUUID(),
      };
      try {
        let response = await s3.send(new PutObjectCommand(putNotificationLog));
        return response;
      } catch (error) {
        console.log("Error putting object in S3:", error);
      }
    };
    res = await uploadLogToBucket(event.body);
    await sendNotification(event);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify(res),
  };
  return response;
};
