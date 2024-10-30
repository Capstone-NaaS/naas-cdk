import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
  CfnOutput,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { DynamoLoggingStack } from "./DynamoLoggingStack";

interface HttpGWStackProps extends StackProps {
  dynamoLoggingStack: DynamoLoggingStack;
  stageName: string;
}
export class HttpGWStack extends Stack {
  constructor(
    scope: Construct,
    id: string,

    props: HttpGWStackProps
  ) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const dynamoLoggingStack = props.dynamoLoggingStack;

    // get logging lambda from s3LoggingStack
    const dynamoLoggerHttp = dynamoLoggingStack.dynamoLoggerHttp;

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

    httpApi.addRoutes({
      path: "/notification",
      methods: [aws_apigatewayv2.HttpMethod.POST],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "PostRequestToLogNotificationThenBroadcast",
        dynamoLoggerHttp
      ),
    });

    httpApi.addRoutes({
      path: "/notification-logs",
      methods: [aws_apigatewayv2.HttpMethod.GET],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "GetRequestForLNotificationLogs",
        dynamoLoggerHttp
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
