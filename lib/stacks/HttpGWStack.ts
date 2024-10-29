import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
  CfnOutput,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { S3LoggingStack } from "./S3LoggingStack";

interface HttpGWStackProps extends StackProps {
  stageName: string;
}
export class HttpGWStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    s3LoggingStack: S3LoggingStack,
    props?: HttpGWStackProps
  ) {
    super(scope, id, props);

    const stageName = props?.stageName || "defaultStage";

    // get logging lambda from s3LoggingStack
    const logLambdaFunction = s3LoggingStack.logLambdaFunction;

    // create http api gateway
    const httpApi = new aws_apigatewayv2.HttpApi(this, `HttpApi-${stageName}`, {
      apiName: `HttpApi-${stageName}`,
    });

    // set stage
    const stage = new aws_apigatewayv2.CfnStage(this, `${stageName}`, {
      apiId: httpApi.httpApiId,
      stageName: stageName,
      autoDeploy: true,
    });

    // post route for cdkTest
    httpApi.addRoutes({
      path: "/cdkTest",
      methods: [aws_apigatewayv2.HttpMethod.POST],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "PostToLogNotificationThenBroadcast",
        logLambdaFunction
      ),
    });

    // output endpoint
    new CfnOutput(this, `HttpApiInvokeUrl-${stageName}`, {
      value: `https://${httpApi.apiId}.execute-api.${this.region}.amazonaws.com/${stageName}`,
      description: "invoke url for the http api dev stage",
      exportName: `HttpApiInvokeUrl-${stageName}`,
    });
  }
}
