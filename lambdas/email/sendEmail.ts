import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Handler } from "aws-lambda";

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

async function checkUserPreferences(user_id) {
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
    // user wants the message
    // send message to SES
  } else {
    // user does not want the message
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify("test response"),
  };

  return response;
};
