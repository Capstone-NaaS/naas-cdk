import { Handler } from "aws-lambda";
import crypto from "node:crypto";

async function validateHash(
  userId: string,
  userHash: string
): Promise<boolean> {
  let computedHash = crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(userId)
    .digest("base64");

  return computedHash === userHash;
}

export const handler: Handler = async function (event, context, callback) {
  const { userId, userHash } = event.queryStringParameters;

  const authorized = await validateHash(userId, userHash);
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
