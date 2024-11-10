import { Handler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { EmailLog, NotificationLogType } from "../types";
import { log } from "console";

const ses = new SESClient();
const sqs = new SQSClient();

async function sendLog(log: EmailLog) {
  // push to queue
  const queueParams: {
    QueueUrl: string;
    MessageBody: string;
  } = {
    QueueUrl: "https://sqs.us-west-1.amazonaws.com/412381737648/ProcessQueue",
    MessageBody: JSON.stringify(log),
  };

  const command = new SendMessageCommand(queueParams);
  return await sqs.send(command);
}

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
