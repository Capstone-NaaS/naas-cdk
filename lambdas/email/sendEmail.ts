import { Handler } from "aws-lambda";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { EmailLog, NotificationLogType } from "../types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const ses = new SESClient();
const sqs = new SQSClient();

async function sendLog(log: EmailLog) {
  // push to queue
  const queueParams = {
    QueueUrl: process.env.LOG_QUEUE,
    MessageBody: JSON.stringify(log),
  };

  const command = new SendMessageCommand(queueParams);
  const sqsResponse = await sqs.send(command);
  return;
}

async function updateLastNotified(user_id: string) {
  const params: UpdateCommandInput = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    Key: {
      id: user_id,
    },
    UpdateExpression: "SET #attrName = :attrValue",
    ExpressionAttributeNames: {
      "#attrName": "last_notified",
    },
    ExpressionAttributeValues: {
      ":attrValue": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    const data = await docClient.send(new UpdateCommand(params));
    console.log("Update succeeded:", data);
  } catch (error) {
    console.error("Update failed:", error);
  }
}

export const handler: Handler = async (log: NotificationLogType) => {
  // email params:
  const params: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [log.receiver_email!], // must be verified emails in sandbox
    },
    Message: {
      Body: {
        Text: {
          Data: `${log.message}`,
        },
      },
      Subject: {
        Data: log.subject,
      },
    },
    Source: process.env.SENDER_EMAIL, // must be verified in SES
  };

  try {
    const sendEmailCommand = new SendEmailCommand(params);
    await ses.send(sendEmailCommand);
    console.log("Email sent successfully");

    const newLog: EmailLog = {
      status: "Email sent.",
      notification_id: log.notification_id,
      user_id: log.user_id,
      channel: "email",
      body: {
        message: log.message,
        subject: log.subject!,
        receiver_email: log.receiver_email!,
      },
    };

    await sendLog(newLog);
    await updateLastNotified(log.user_id);
    // TODO: need to add log for successful email send
  } catch (error) {
    console.error("Error sending email:", error);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("test response"),
  };

  return response;
};
