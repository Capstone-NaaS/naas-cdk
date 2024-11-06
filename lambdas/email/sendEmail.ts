import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Handler } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient();

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

async function checkUserPreferences(user_id: string) {
  const getCommand = new GetCommand({
    TableName: process.env.USER_PREFERENCES_TABLE,
    Key: { user_id },
    ProjectionExpression: "email",
  });
  const response = await docClient.send(getCommand);
  const inAppPref = response.Item?.email;
  if (!inAppPref) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "User preference turned off." }),
    };
  } else
    return {
      statusCode: 200,
      body: true,
    };
}

export const handler: Handler = async (log) => {
  let emailPrefOn = await checkUserPreferences(log.user_id);
  if (emailPrefOn.body === true) {
    // email params:
    const params = {
      Destination: {
        ToAddresses: [process.env.RECEIVER_EMAIL], // must be verified emails in sandbox
      },
      Message: {
        Body: {
          Text: {
            Data: `${log.message}`,
          },
        },
        Subject: {
          Data: "Test Email from Lambda",
        },
      },
      Source: process.env.SENDER_EMAIL, // must be verified in SES
    };
    try {
      const sendEmailCommand = new SendEmailCommand(params);
      await ses.send(sendEmailCommand);
      console.log("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  } else {
    console.log("Email preference turned off");
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("test response"),
  };

  return response;
};
