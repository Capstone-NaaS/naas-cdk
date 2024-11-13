import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayProxyHandler } from "aws-lambda";

const sqsClient = new SQSClient();

export const handler: APIGatewayProxyHandler = async (event, context) => {
  let allMessages: string[] = [];

  try {
    let messagesExist = true;
    while (messagesExist) {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: process.env.DLQ_URL!,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      });

      const receiveResponse = await sqsClient.send(receiveCommand);

      if (receiveResponse.Messages && receiveResponse.Messages.length > 0) {
        const fetchedMessages: string[] = receiveResponse.Messages.map(
          (message) => message.Body || ""
        );

        allMessages = [...allMessages, ...fetchedMessages];
      } else {
        messagesExist = false;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(allMessages),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching messages:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed to fetch messages from the dead-letter queue.",
          error: error.message,
        }),
      };
    } else {
      console.error("Unknown error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed to fetch messages from the dead-letter queue.",
          error: "Unknown error",
        }),
      };
    }
  }
};
