import { APIGatewayProxyEventV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEventV2) => {
  return {
    isAuthorized: event.headers.authorization === process.env.SECRET_KEY,
  };
};
