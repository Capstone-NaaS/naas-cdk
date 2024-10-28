// http-api-stack.ts
import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
  CfnOutput,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { S3LoggingStack } from "./S3LoggingStack";
// import { WebSocketGWStack } from "./WebSocketGWStack";

export class HttpGWStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    // websocketGwStack: WebSocketGWStack,
    s3LoggingStack: S3LoggingStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    // // get the websocketBroadcast lambda function from the WebSocketGWStack
    // const websocketBroadcast = websocketGwStack.websocketBroadcast;

    // get logging lambda from s3LoggingStack
    const logLambdaFunction = s3LoggingStack.logLambdaFunction;

    // create http api gateway
    const httpApi = new aws_apigatewayv2.HttpApi(this, "HttpApi-test-f", {
      apiName: "HttpApi-test-f",
    });

    // set stage
    const stage = new aws_apigatewayv2.CfnStage(this, "DevStage-test-f", {
      apiId: httpApi.httpApiId,
      stageName: "Dev-f",
      autoDeploy: true,
    });

    // post route for cdkTest
    httpApi.addRoutes({
      path: "/cdkTest",
      methods: [aws_apigatewayv2.HttpMethod.POST],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "PostToLogNotificationThenBroadcast",
        // websocketBroadcast
        logLambdaFunction
      ),
    });

    // output endpoint
    new CfnOutput(this, "HttpApiInvokeUrl-test-f", {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com/dev-f`,
      description: "invoke url for the http api dev stage",
      exportName: "HttpApiInvokeUrl-test",
    });
  }
}
