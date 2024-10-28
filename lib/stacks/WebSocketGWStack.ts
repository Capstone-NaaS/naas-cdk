import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  CfnOutput,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as path from "path";

import { ConnectionIDddb } from "../constructs/ConnectionIDddb";
import { ActiveNotifDdb } from "../constructs/ActiveNotifDdb";

export class WebSocketGWStack extends Stack {
  // http api gateway needs to share this lambda
  public readonly saveActiveNotification: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create websocket gateway
    const wsapi = new aws_apigatewayv2.CfnApi(this, "ApiGwSocket-test-dev", {
      name: "ApiGwSocket-test-dev",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    // create dynamo db table to hold connection ids
    const connectionIDddb = new ConnectionIDddb(
      this,
      "ConnectionIdTableConstruct-test-dev"
    );

    // create dynamo db table to hold active notifications
    const activeNotifDdb = new ActiveNotifDdb(
      this,
      "ActiveNotifTableConstruct-test-dev"
    );

    // create websocket disconnect lambda
    const websocketDisconnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketDisonnect-test-dev",
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
      "websocketBroadcast-test-dev",
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
          WEBSOCKET_ENDPOINT: `https://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/dev`,
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
      "websocketConnect-test-dev",
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
      "saveActiveNotification-test-dev",
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

    // create notification update lambda
    const updateNotification = new aws_lambda_nodejs.NodejsFunction(
      this,
      "updateNotification-test-dev",
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

    // create role for gateway to invoke lambdas
    const role = new aws_iam.Role(this, "LambdaInvokeRole-test-dev", {
      roleName: "LambdaInvokeRole-test-dev",
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
      "ConnectIntegration-test-dev",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketConnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const disconnectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "DisonnectIntegration-test-dev",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDisconnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const broadcastIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "BroadcastIntegration-test-dev",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketBroadcast.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const updateNotificationIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "UpdateNotificationIntegration-test-dev",
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
      "ConnectRoute-test-dev",
      {
        apiId: wsapi.ref,
        routeKey: "$connect",
        authorizationType: "NONE",
        target: "integrations/" + connectIntegration.ref,
      }
    );

    const disconnectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "DisconnectRoute-test-dev",
      {
        apiId: wsapi.ref,
        routeKey: "$disconnect",
        authorizationType: "NONE",
        target: "integrations/" + disconnectIntegration.ref,
      }
    );

    const broadcastRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "BroadcastRoute-test-dev",
      {
        apiId: wsapi.ref,
        routeKey: "broadcast",
        authorizationType: "NONE",
        target: "integrations/" + broadcastIntegration.ref,
      }
    );

    const updateNotificationRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "UpdateNotificationRoute-test-dev",
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

    // permission for lambdas to call other lambdas
    websocketBroadcast.grantInvoke(saveActiveNotification);
    websocketBroadcast.grantInvoke(websocketConnect);

    // deployment
    const deployment = new aws_apigatewayv2.CfnDeployment(
      this,
      "deployment-test-dev",
      {
        apiId: wsapi.ref,
      }
    );

    const stage = new aws_apigatewayv2.CfnStage(this, "DevStage-test-dev", {
      stageName: "dev",
      apiId: wsapi.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
    });

    // add deployment dependencies
    deployment.node.addDependency(connectRoute);
    deployment.node.addDependency(disconnectRoute);
    deployment.node.addDependency(broadcastRoute);
    deployment.node.addDependency(updateNotificationRoute);

    // output
    new CfnOutput(this, "wssEndpoint-test-dev", {
      exportName: "wssEndpoint-test-dev",
      value: `wss://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/dev`,
    });
  }
}
