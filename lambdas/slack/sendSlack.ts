import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SlackLog, NotificationLogType } from "../types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqs = new SQSClient();

async function sendLog(log: SlackLog) {
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
  const response = await fetch(log.slack!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: log.message,
    }),
  });

  // const params: SendEmailCommandInput = {
  //   Destination: {
  //     ToAddresses: [log.receiver_email!], // must be verified emails in sandbox
  //   },
  //   Message: {
  //     Body: {
  //       Text: {
  //         Data: `${log.message}`,
  //       },
  //     },
  //     Subject: {
  //       Data: log.subject,
  //     },
  //   },
  //   Source: process.env.SENDER_EMAIL, // must be verified in SES
  // };

  // try {
  //   const sendEmailCommand = new SendEmailCommand(params);
  //   const emailResponse = await ses.send(sendEmailCommand);

  //   if (emailResponse.$metadata.httpStatusCode === 200) {
  //     console.log("Email sent successfully:", emailResponse);

  //     const newLog: EmailLog = {
  //       status: "Email sent.",
  //       notification_id: log.notification_id,
  //       user_id: log.user_id,
  //       channel: "email",
  //       body: {
  //         message: log.message,
  //         subject: log.subject!,
  //         receiver_email: log.receiver_email!,
  //       },
  //     };

  //     await sendLog(newLog);
  //     await updateLastNotified(log.user_id);
  //   } else {
  //     const newLog: EmailLog = {
  //       status: "Email could not be sent.",
  //       notification_id: log.notification_id,
  //       user_id: log.user_id,
  //       channel: "email",
  //       body: {
  //         message: log.message,
  //         subject: log.subject!,
  //         receiver_email: log.receiver_email!,
  //       },
  //     };
  //     await sendLog(newLog);
  //   }
  // } catch (error) {
  //   console.error("Error sending email:", error);
  // }

  return response;
};
