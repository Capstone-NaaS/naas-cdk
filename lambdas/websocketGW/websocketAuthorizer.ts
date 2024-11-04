import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

async function userHashExists(userHash: string) {
  const client = new DynamoDBClient({});
  const dynamoDb = DynamoDBDocumentClient.from(client);

  const params = {
    TableName: process.env.USER_ATTRIBUTES_TABLE,
    IndexName: "userHash-index",
    KeyConditionExpression: "userHash = :userHash",
    ExpressionAttributeValues: {
      ":userHash": userHash,
    },
  };

  try {
    const data = await dynamoDb.send(new QueryCommand(params));
    return data.Items.length > 0;
  } catch (error) {
    console.error("Error querying GSI:", error);
    return error;
  }
}

export const handler: Handler = async function (event, context, callback) {
  const userHash = event.queryStringParameters.user_id;
  const authorized = await userHashExists(userHash);
  if (authorized) {
    callback(null, generateAllow("me", event.methodArn));
  } else {
    callback("Unauthorized");
  }
};

var generatePolicy = function (
  principalId: string,
  effect: string,
  resource: string
) {
  var authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    var policyDocument = {};
    policyDocument.Version = "2012-10-17";
    policyDocument.Statement = [];
    var statementOne = {};
    statementOne.Action = "execute-api:Invoke";
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

var generateAllow = function (principalId: string, resource: string) {
  return generatePolicy(principalId, "Allow", resource);
};
