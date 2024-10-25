import { Construct } from "constructs";
import {
  aws_apigatewayv2,
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  CfnOutput,
  Duration,
  Fn,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import * as path from "path";

import { ConnectionIDddb } from "../constructs/ConnectionIDddb";

export class WebSocketGWStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // create websocket gateway
    const wsapi = new aws_apigatewayv2.CfnApi(this, "ApiGwSocket-test", {
      name: "ApiGwSocket-test",
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.action",
    });

    // create dynamo db table to hold connection ids
    const connectionIDddb = new ConnectionIDddb(
      this,
      "ConnectionIdTableConstruct"
    );

    // create websocket connect lambda
    const websocketConnect = new aws_lambda_nodejs.NodejsFunction(
      this,
      "websocketConnect-test",
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
      "websocketDisonnect-test",
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
      "websocketBroadcast-test",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/websocketGW/websocketBroadcast.ts"
        ),
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

    // create role for gateway to invoke lambdas
    const role = new aws_iam.Role(this, "LambdaInvokeRole", {
      roleName: "LambdaInvokeRole",
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    role.addToPolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: [
          websocketConnect.functionArn,
          websocketDisconnect.functionArn,
          websocketBroadcast.functionArn,
        ],
        actions: ["lambda:InvokeFunction"],
      })
    );

    // integrate lambdas
    const connectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "ConnectIntegration-test",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketConnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const disconnectIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "DisonnectIntegration-test",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketDisconnect.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    const broadcastIntegration = new aws_apigatewayv2.CfnIntegration(
      this,
      "BroadcastIntegration-test",
      {
        apiId: wsapi.ref,
        integrationType: "AWS_PROXY",
        integrationUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${websocketBroadcast.functionArn}/invocations`,
        credentialsArn: role.roleArn,
      }
    );

    // create routes
    const connectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "ConnectRoute-test",
      {
        apiId: wsapi.ref,
        routeKey: "$connect",
        authorizationType: "NONE",
        target: "integrations/" + connectIntegration.ref,
      }
    );

    const disconnectRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "DisconnectRoute-test",
      {
        apiId: wsapi.ref,
        routeKey: "$disconnect",
        authorizationType: "NONE",
        target: "integrations/" + disconnectIntegration.ref,
      }
    );

    const broadcastRoute = new aws_apigatewayv2.CfnRoute(
      this,
      "BroadcastRoute-test",
      {
        apiId: wsapi.ref,
        routeKey: "broadcast",
        authorizationType: "NONE",
        target: "integrations/" + broadcastIntegration.ref,
      }
    );

    // grant dynamo permissions to lambdas
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketConnect);
    connectionIDddb.ConnectionIdTable.grantWriteData(websocketDisconnect);
    connectionIDddb.ConnectionIdTable.grantReadData(websocketBroadcast);

    // deployment
    const deployment = new aws_apigatewayv2.CfnDeployment(
      this,
      "deployment-test",
      {
        apiId: wsapi.ref,
      }
    );

    const stage = new aws_apigatewayv2.CfnStage(this, "DevStage-test", {
      stageName: "dev",
      apiId: wsapi.ref,
      autoDeploy: true,
      deploymentId: deployment.ref,
    });

    // add deployment dependencies
    deployment.node.addDependency(connectRoute);
    deployment.node.addDependency(disconnectRoute);
    deployment.node.addDependency(broadcastRoute);

    // output
    new CfnOutput(this, "wssEndpoint-test", {
      exportName: "wssEndpoint-test",
      value: `wss://${wsapi.ref}.execute-api.${this.region}.amazonaws.com/dev`,
    });
  }
}
