import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
  CfnOutput,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { WebSocketGWStack } from "./WebSocketGWStack";

export class HttpGWStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    websocketGwStack: WebSocketGWStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    // get the websocketBroadcast lambda function from the WebSocketGWStack
    const saveActiveNotification = websocketGwStack.saveActiveNotification;

    // create http api gateway
    const httpApi = new aws_apigatewayv2.HttpApi(this, "HttpApi-test-dev", {
      apiName: "HttpApi-test-dev",
    });

    // set stage
    const stage = new aws_apigatewayv2.CfnStage(this, "DevStage-test-dev", {
      apiId: httpApi.httpApiId,
      stageName: "dev",
      autoDeploy: true,
    });

    // post route for cdkTest
    httpApi.addRoutes({
      path: "/cdkTest",
      methods: [aws_apigatewayv2.HttpMethod.POST],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "PostToBroadcastLambda-test-dev",
        saveActiveNotification
      ),
    });

    // output endpoint
    new CfnOutput(this, "HttpApiInvokeUrl-test-dev", {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com/dev`,
      description: "invoke url for the http api dev stage",
      exportName: "HttpApiInvokeUrl-test-dev",
    });
  }
}
