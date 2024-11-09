import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Handler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { NotificationLogType } from "../types";

const ses = new SESClient();

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

export const handler: Handler = async (log: NotificationLogType) => {
  // email params:
  const params = {
    Destination: {
      ToAddresses: [log.receiver_email], // must be verified emails in sandbox
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
