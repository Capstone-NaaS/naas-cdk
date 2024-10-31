import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  aws_logs,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as path from "path";

import { ConnectionIDddb } from "../constructs/ConnectionIDddb";
import { ActiveNotifDdb } from "../constructs/ActiveNotifDdb";
import { CommonStack } from "./CommonStack";

interface WebSocketGWStackProps extends StackProps {
  stageName: string;
  commonStack: CommonStack;
}

export class WebSocketGWStack extends Stack {
  public readonly saveActiveNotification: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: WebSocketGWStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const commonStack = props.commonStack;

    // create websocket gateway
    const wsapi = new aws_apigatewayv2.CfnApi(
      this,
      `ApiGwSocket-${stageName}`,
      {
        name: `ApiGwSocket-${stageName}`,
        protocolType: "WEBSOCKET",
        routeSelectionExpression: "$request.body.action",
      }
    );

    // create dynamo db table to hold connection ids
    const connectionIDddb = new ConnectionIDddb(
      this,
      `ConnectionIdTableConstruct-${stageName}`,
      {
        stageName,
      }
    );

    // create dynamo db table to hold active notifications
    const activeNotifDdb = new ActiveNotifDdb(
      this,
      `ActiveNotifTableConstruct-${stageName}`,
      {
        stageName,
      }
    );

    // create websocket disconnect lambda
    const websocketDisconnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      `websocketDisonnect-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketDisconnect.ts"
        ),
        environment: {
          CONNECTION_TABLE: connectionIDddb.ConnectionIdTable.tableName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
      }
    );

    // create websocket broadcast lambda
    const websocketBroadcast = new aws_lambda_nodejs.NodejsFunction(
      this,
      `websocketBroadcast-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketBroadcast.ts"
        ),
        bundling: {
          externalModules: ["@aws-sdk"],
        },
        environment: {
          CONNECTION_TABLE: connectionIDddb.ConnectionIdTable.tableName,
          WEBSOCKET_ENDPOINT: `https://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/${stageName}`,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
        initialPolicy: [
          new aws_iam.PolicyStatement({
            effect: aws_iam.Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: ["*"],
          }),
        ],
      }
    );

    // create websocket connect lambda
    const websocketConnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      `websocketConnect-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketConnect.ts"
        ),
        environment: {
          CONNECTION_TABLE: connectionIDddb.ConnectionIdTable.tableName,
          ACTIVE_NOTIF_TABLE: activeNotifDdb.ActiveNotifDdb.tableName,
          WS_BROADCAST_LAMBDA: websocketBroadcast.functionName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
      }
    );

    // create saving a new active notification lambda
    const saveActiveNotification = new aws_lambda_nodejs.NodejsFunction(
      this,
      `saveActiveNotification-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/saveActiveNotification.ts"
        ),
        bundling: {
          externalModules: ["@aws-sdk"],
        },
        environment: {
          ACTIVE_NOTIF_TABLE: activeNotifDdb.ActiveNotifDdb.tableName,
          WS_BROADCAST_LAMBDA: websocketBroadcast.functionName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
        initialPolicy: [
          new aws_iam.PolicyStatement({
            effect: aws_iam.Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: ["*"],
          }),
        ],
      }
    );
    this.saveActiveNotification = saveActiveNotification;

    // duplicate dynamo logger for now. this one is for ws gw.
    // create dynamoLogger lambda
    const dynamoLoggerWs = new aws_lambda_nodejs.NodejsFunction(
      this,
      `dynamoLogger-ws-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/dynamoNotifLogs/dynamoLogger.ts"
        ),
        environment: {
          NOTIFICATION_LOG_TABLE:
            commonStack.notificationLogsDB.NotificationLogTable.tableName,
          SEND_NOTIFICATION: saveActiveNotification.functionName,
        },
      }
    );

    // create notification update lambda
    const updateNotification = new aws_lambda_nodejs.NodejsFunction(
      this,
      `updateNotification-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/updateNotification.ts"
        ),
        bundling: {
          externalModules: ["@aws-sdk"],
        },
        environment: {
          ACTIVE_NOTIF_TABLE: activeNotifDdb.ActiveNotifDdb.tableName,
          DYNAMO_LOGGER_FN: dynamoLoggerWs.functionName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
        initialPolicy: [
          new aws_iam.PolicyStatement({
            effect: aws_iam.Effect.ALLOW,
            actions: ["execute-api:ManageConnections"],
            resources: ["*"],
          }),
        ],
      }
    );

    dynamoLoggerWs.grantInvoke(updateNotification);

    // create role for gateway to invoke lambdas
    const role = new aws_iam.Role(this, `LambdaInvokeRole-${stageName}`, {
      roleName: `LambdaInvokeRole-${stageName}`,
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: [
          websocketConnect.functionArn,
          websocketDisconnect.functionArn,
          websocketBroadcast.functionArn,
          updateNotification.functionArn,
        ],
        actions: ["lambda:InvokeFunction"],
      })
    );

    // integrate lambdas
    const connectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      `ConnectIntegration-${stageName}`,
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketConnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const disconnectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      `DisonnectIntegration-${stageName}`,
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDisconnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const broadcastIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      `BroadcastIntegration-${stageName}`,
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketBroadcast.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const updateNotificationIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      `UpdateNotificationIntegration-${stageName}`,
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${updateNotification.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    // create routes
    const connectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      `ConnectRoute-${stageName}`,
      {
        apiId: wsapi.ref,
        routeKey: "$connect",
        authorizationType: "NONE",
        target: "integrations/" + connectIntegration.ref,
      }
    );

    const disconnectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      `DisconnectRoute-${stageName}`,
      {
        apiId: wsapi.ref,
        routeKey: "$disconnect",
        authorizationType: "NONE",
        target: "integrations/" + disconnectIntegration.ref,
      }
    );

    const broadcastRoute = new aws_apigatewayv2.CfnRoute(
      this,
      `BroadcastRoute-${stageName}`,
      {
        apiId: wsapi.ref,
        routeKey: "broadcast",
        authorizationType: "NONE",
        target: "integrations/" + broadcastIntegration.ref,
      }
    );

    const updateNotificationRoute = new aws_apigatewayv2.CfnRoute(
      this,
      `UpdateNotificationRoute-${stageName}`,
      {
        apiId: wsapi.ref,
        routeKey: "updateNotification",
        authorizationType: "NONE",
        target: "integrations/" + updateNotificationIntegration.ref,
      }
    );

    // grant dynamo permissions to lambdas
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketConnect);
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketDisconnect);
    connectionIDddb.ConnectionIdTable.grantReadData(websocketBroadcast);

    activeNotifDdb.ActiveNotifDdb.grantWriteData(saveActiveNotification);
    activeNotifDdb.ActiveNotifDdb.grantReadData(websocketConnect);
    activeNotifDdb.ActiveNotifDdb.grantReadWriteData(updateNotification);

    commonStack.notificationLogsDB.NotificationLogTable.grantReadWriteData(
      dynamoLoggerWs
    );

    // permission for lambdas to call other lambdas
    websocketBroadcast.grantInvoke(saveActiveNotification);
    websocketBroadcast.grantInvoke(websocketConnect);

    // creating log group for access logs
    const logGroup = new aws_logs.LogGroup(this, "WSGatewayAccessLogs", {
      logGroupName: `WSGatewayAccessLogs-${stageName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: aws_logs.RetentionDays.ONE_MONTH,
    });

    // create a role for API Gateway
    const apiGatewayRole = new aws_iam.Role(this, "ApiGatewayLoggingRole", {
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    // Grant API Gateway permissions to write to Cloudwatch logs
    logGroup.grantWrite(apiGatewayRole);

    // deployment
    const deployment = new aws_apigatewayv2.CfnDeployment(
      this,
      `deployment-${stageName}`,
      {
        apiId: wsapi.ref,
      }
    );

    const stage = new aws_apigatewayv2.CfnStage(this, `${stageName}`, {
      stageName: `${stageName}`,
      apiId: wsapi.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
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

    // add deployment dependencies
    deployment.node.addDependency(connectRoute);
    deployment.node.addDependency(disconnectRoute);
    deployment.node.addDependency(broadcastRoute);
    deployment.node.addDependency(updateNotificationRoute);

    // output
    new CfnOutput(this, `wssEndpoint-${stageName}`, {
      exportName: `wssEndpoint-${stageName}`,
      value: `wss://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/${stageName}`,
    });
  }
}
