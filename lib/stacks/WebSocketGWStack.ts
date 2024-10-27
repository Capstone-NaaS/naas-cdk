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
    const wsapi = new aws_apigatewayv2.CfnApi(this, "ApiGwSocket-test-k", {
      name: "ApiGwSocket-test-k",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    // create dynamo db table to hold connection ids
    const connectionIDddb = new ConnectionIDddb(
      this,
      "ConnectionIdTableConstruct-test-k"
    );

    // create dynamo db table to hold active notifications
    const activeNotifDdb = new ActiveNotifDdb(
      this,
      "ActiveNotifTableConstruct-test-k"
    );

    // create websocket connect lambda
    const websocketConnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketConnect-test-k",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketConnect.ts"
        ),
        environment: {
          TABLE_NAME: connectionIDddb.ConnectionIdTable.tableName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
      }
    );

    // create websocket disconnect lambda
    const websocketDisconnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketDisonnect-test-k",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketDisconnect.ts"
        ),
        environment: {
          TABLE_NAME: connectionIDddb.ConnectionIdTable.tableName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
      }
    );

    // create websocket broadcast lambda
    const websocketBroadcast = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketBroadcast-test-k",
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
          TABLE_NAME: connectionIDddb.ConnectionIdTable.tableName,
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

    // create saving a new active notification lambda
    const saveActiveNotification = new aws_lambda_nodejs.NodejsFunction(
      this,
      "saveActiveNotification-test-k",
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
        memorySize: 128,
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

    // create updating connection info with userHash lambda
    const websocketAddConnectionUser = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketAddConnectionUser-test-k",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketAddConnectionUser.ts"
        ),
        environment: {
          TABLE_NAME: connectionIDddb.ConnectionIdTable.tableName,
        },
        timeout: Duration.seconds(100),
        memorySize: 256,
      }
    );

    // create role for gateway to invoke lambdas
    const role = new aws_iam.Role(this, "LambdaInvokeRole-test-k", {
      roleName: "LambdaInvokeRole-test-k",
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: [
          websocketConnect.functionArn,
          websocketDisconnect.functionArn,
          websocketBroadcast.functionArn,
          websocketAddConnectionUser.functionArn,
        ],
        actions: ["lambda:InvokeFunction"],
      })
    );

    // integrate lambdas
    const connectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "ConnectIntegration-test-k",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketConnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const disconnectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "DisonnectIntegration-test-k",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDisconnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const broadcastIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "BroadcastIntegration-test-k",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketBroadcast.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const addUserIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "AddUserIntegration-test-k",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketAddConnectionUser.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    // create routes
    const connectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "ConnectRoute-test-k",
      {
        apiId: wsapi.ref,
        routeKey: "$connect",
        authorizationType: "NONE",
        target: "integrations/" + connectIntegration.ref,
      }
    );

    const disconnectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "DisconnectRoute-test-k",
      {
        apiId: wsapi.ref,
        routeKey: "$disconnect",
        authorizationType: "NONE",
        target: "integrations/" + disconnectIntegration.ref,
      }
    );

    const broadcastRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "BroadcastRoute-test-k",
      {
        apiId: wsapi.ref,
        routeKey: "broadcast",
        authorizationType: "NONE",
        target: "integrations/" + broadcastIntegration.ref,
      }
    );

    const addConnectionUserRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "AddConnectionUserRoute-test-k",
      {
        apiId: wsapi.ref,
        routeKey: "addConnectionUser",
        authorizationType: "NONE",
        target: "integrations/" + addUserIntegration.ref,
      }
    );

    // grant dynamo permissions to lambdas
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketConnect);
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketDisconnect);
    connectionIDddb.ConnectionIdTable.grantReadData(websocketBroadcast);
    connectionIDddb.ConnectionIdTable.grantWriteData(
      websocketAddConnectionUser
    );

    activeNotifDdb.ActiveNotifDdb.grantWriteData(saveActiveNotification);

    // permission for lambdas to call other lambdas
    websocketBroadcast.grantInvoke(saveActiveNotification);

    // deployment
    const deployment = new aws_apigatewayv2.CfnDeployment(
      this,
      "deployment-test-k",
      {
        apiId: wsapi.ref,
      }
    );

    const stage = new aws_apigatewayv2.CfnStage(this, "DevStage-test-k", {
      stageName: "dev",
      apiId: wsapi.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
    });

    // add deployment dependencies
    deployment.node.addDependency(connectRoute);
    deployment.node.addDependency(disconnectRoute);
    deployment.node.addDependency(broadcastRoute);
    deployment.node.addDependency(addConnectionUserRoute);

    // output
    new CfnOutput(this, "wssEndpoint-test-k", {
      exportName: "wssEndpoint-test-k",
      value: `wss://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/dev`,
    });
  }
}
