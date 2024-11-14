import * as crypto from "node:crypto";
import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const db = new DynamoDBClient();
const dynamoDb = DynamoDBDocumentClient.from(db);

interface Statement {
  Action: string;
  Effect: string;
  Resource: string;
}

interface PolicyDocument {
  Version: string;
  Statement: Statement[];
}

interface AuthResponse {
  principalId: string;
  policyDocument?: PolicyDocument;
}

const validateHash = async (
  user_id: string,
  userHash: string
): Promise<boolean> => {
  let computedHash = crypto
    .createHmac("sha256", process.env.SECRET_KEY!)
    .update(user_id)
    .digest("base64");

  return computedHash === userHash;
};

const userExists = async (id: string): Promise<boolean> => {
  const params = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(`Error getting user:`, error);
    return false;
  }
};

const generatePolicy = (
  principalId: string,
  effect: string,
  resource: string
): AuthResponse => {
  const authResponse: AuthResponse = { principalId };

  if (effect && resource) {
    const policyDocument: PolicyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    };
    authResponse.policyDocument = policyDocument;
  }

  return authResponse;
};

const generateAllow = (principalId: string, resource: string) => {
  return generatePolicy(principalId, "Allow", resource);
};

export const handler: Handler = async function (event, context, callback) {
  const { user_id, userHash } = event.queryStringParameters;
  const validUser = await userExists(user_id);
  const validHash = await validateHash(user_id, userHash);

  if (validUser && validHash) {
    callback(null, generateAllow("me", event.methodArn));
  } else {
    callback("Unauthorized");
  }
};
