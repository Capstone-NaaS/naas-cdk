import { randomUUID } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
const db = new DynamoDBClient();
const dynamoDb = DynamoDBDocumentClient.from(db);

const sqs = new SQSClient();

async function createRequest(
  user_id: string,
  channel_type: string,
  channel_body: { message: string; subject?: string }
) {
  // required arguments to begin processing request
  if (!user_id || !channel_type || !channel_body) {
    throw new Error(
      "Missing required arguments: user_id, channel, and a channel body must be provided."
    );
  }

  const notification_id = randomUUID();
  const base_log = {
    notification_id,
    user_id,
    channel: channel_type,
  };
  if (channel_type === "in_app") {
    return {
      ...base_log,
      body: {
        message: channel_body.message,
      },
    };
  } else if (channel_type === "email") {
    const user_email = await fetchUserAttribute(user_id);
    return {
      ...base_log,
      body: {
        receiver_email: user_email,
        subject: channel_body.subject,
        message: channel_body.message,
      },
    };
  }
}

async function verifyUser(user_id: string) {
  const params = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    Key: {
      id: user_id,
    },
  };
  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      return {
        statusCode: 200,
      };
    } else {
      return {
        statusCode: 400,
        body: "User does not exist",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting user",
    };
  }
}

async function fetchUserAttribute(user_id: string) {
  const params = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    Key: {
      id: user_id,
    },
  };
  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      return data.Item.email;
    } else {
      return {
        statusCode: 400,
        body: "User attribute does not exists",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting user attribute",
    };
  }
}

export const handler: Handler = async (event) => {
  let response;
  const responseBody: Object[] = [];

  try {
    const body = JSON.parse(event.body);

    // verify user exists in our attributes table
    try {
      let userExists = await verifyUser(body.user_id);
      if (userExists.statusCode === 200) {
        console.log("User verified");
      } else {
        throw new Error("User does not exist");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Error fetching user");
    }

    // for each object in channel, parse to prepare for queue
    await Promise.all(
      Object.keys(body.channels).map(async (channel) => {
        const notificationRequest = await createRequest(
          body.user_id,
          channel,
          body.channels[channel]
        );

        // push to queue
        const queueParams = {
          QueueUrl: process.env.QUEUE_URL,
          MessageBody: JSON.stringify(notificationRequest),
        };

        try {
          const command = new SendMessageCommand(queueParams);
          const sqsResponse = await sqs.send(command);
          console.log("Success! Message send to queue: ", notificationRequest);
        } catch (error) {
          console.error("Error sending message to queue: ", error);
        }

        // push notification_id to responseBody for each channel
        responseBody.push({
          channel,
          notification_id: notificationRequest?.notification_id,
        });
      })
    );

    response = {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    response = {
      statusCode: 500,
      body: "could not process request",
    };
    console.error("error", error);
  }

  return response;
};
