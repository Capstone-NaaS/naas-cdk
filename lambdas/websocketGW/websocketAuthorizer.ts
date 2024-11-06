import { Handler } from "aws-lambda";
import crypto from "node:crypto";

async function validateHash(
  user_id: string,
  userHash: string
): Promise<boolean> {
  let computedHash = crypto
    .createHmac("sha256", process.env.SECRET_KEY)
    .update(user_id)
    .digest("base64");

  return computedHash === userHash;
}

export const handler: Handler = async function (event, context, callback) {
  const { user_id, userHash } = event.queryStringParameters;

  const authorized = await validateHash(user_id, userHash);
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
