import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_apigatewayv2_integrations,
  CfnOutput,
  Stack,
  StackProps,
  aws_logs,
  RemovalPolicy,
  aws_iam,
  aws_lambda_nodejs,
  aws_lambda,
} from "aws-cdk-lib";
import { DynamoLoggingStack } from "./DynamoLoggingStack";
import * as path from "path";
import { CommonStack } from "./CommonStack";

interface HttpGWStackProps extends StackProps {
  dynamoLoggingStack: DynamoLoggingStack;
  stageName: string;
  commonStack: CommonStack;
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
    const commonStack = props.commonStack;

    // get logging lambda from dynamo logging stack
    const dynamoLoggerHttp = dynamoLoggingStack.dynamoLoggerHttp;

    // create userFunctions lambda
    const userFunctions = new aws_lambda_nodejs.NodejsFunction(
      this,
      `userFunctions-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/userAttributes/userFunctions.js"
        ),
        environment: {
          USERDB: commonStack.userAttributesDB.UserAttributesTable.tableName,
        },
      }
    );

    // give lambda permission to access dynamo
    commonStack.userAttributesDB.UserAttributesTable.grantReadWriteData(
      userFunctions
    );

    // create http api gateway
    const httpApi = new aws_apigatewayv2.HttpApi(this, `HttpApi-${stageName}`, {
      apiName: `HttpApi-${stageName}`,
    });

    // creating log group for access logs
    const logGroup = new aws_logs.LogGroup(this, "HTTPGatewayAccessLogs", {
      logGroupName: `HTTPGatewayAccessLogs-${stageName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: aws_logs.RetentionDays.ONE_MONTH,
    });

    // create a role for API Gateway
    const apiGatewayRole = new aws_iam.Role(this, "ApiGatewayLoggingRole", {
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    // Grant API Gateway permissions to write to Cloudwatch logs
    logGroup.grantWrite(apiGatewayRole);

    // set stage
    const stage = new aws_apigatewayv2.CfnStage(this, `${stageName}`, {
      apiId: httpApi.httpApiId,
      stageName: stageName,
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: logGroup.logGroupArn,
        format: JSON.stringify({
          requestId: "$context.requestId",
          userAgent: "$context.identity.userAgent",
          sourceIp: "$context.identity.sourceIp",
          requestTime: "$context.requestTime",
          httpMethod: "$context.httpMethod",
          path: "$context.path",
          status: "$context.status",
          responseLength: "$context.responseLength",
        }),
      },
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

    httpApi.addRoutes({
      path: "/user",
      methods: [aws_apigatewayv2.HttpMethod.ANY],
      integration: new aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "UserFunctions",
        userFunctions
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
