import {
  Stack,
  StackProps,
  aws_lambda_nodejs,
  aws_lambda,
  Lazy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

import { WebSocketGWStack } from "./WebSocketGWStack";
import { CommonStack } from "./CommonStack";

interface DynamoLoggingStackProps extends StackProps {
  stageName: string;
  websocketGwStack: WebSocketGWStack;
  commonStack: CommonStack;
}

export class DynamoLoggingStack extends Stack {
  // need to share logging lambda
  public readonly dynamoLoggerHttp: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: DynamoLoggingStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const webSocketGWStack = props.websocketGwStack;
    const commonStack = props.commonStack;

    // create dynamoLogger lambda
    const dynamoLoggerHttp = new aws_lambda_nodejs.NodejsFunction(
      this,
      `dynamoLogger-http-${stageName}`,
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
          SEND_NOTIFICATION:
            webSocketGWStack.saveActiveNotification.functionName,
        },
      }
    );
    this.dynamoLoggerHttp = dynamoLoggerHttp;

    //give lambda permission to dynamo
    commonStack.notificationLogsDB.NotificationLogTable.grantReadWriteData(
      dynamoLoggerHttp
    );

    // allow dynamoLogger to call saveActiveNotification
    webSocketGWStack.saveActiveNotification.grantInvoke(dynamoLoggerHttp);
  }
}
