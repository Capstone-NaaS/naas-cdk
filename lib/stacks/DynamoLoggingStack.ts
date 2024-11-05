import { Stack, StackProps, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

import { WebSocketGWStack } from "./WebSocketGWStack";
import { CommonStack } from "./CommonStack";

interface DynamoLoggingStackProps extends StackProps {
  stageName: string;
  commonStack: CommonStack;
  websocketGwStack: WebSocketGWStack;
}

export class DynamoLoggingStack extends Stack {
  // need to share logging lambda
  public readonly dynamoLoggerHttp: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: DynamoLoggingStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const commonStack = props.commonStack;
    const websocketGwStack = props.websocketGwStack;

    // create email sending Lambda
    const sendEmail = new aws_lambda_nodejs.NodejsFunction(
      this,
      `sendEmail-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "../../lambdas/email/sendEmail.ts"),
        environment: {
          USER_PREFERENCES_TABLE:
            commonStack.userPreferencesDdb.UserPreferencesDdb.tableName,
        },
      }
    );

    // create dynamoLogger lambda
    const dynamoLoggerHttp = new aws_lambda_nodejs.NodejsFunction(
      this,
      `dynamoLoggerHttp-${stageName}`,
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
            websocketGwStack.saveActiveNotification.functionName,
          EMAIL_NOTIFICATION: sendEmail.functionName,
        },
      }
    );
    this.dynamoLoggerHttp = dynamoLoggerHttp;

    //give lambda permission to dynamo
    commonStack.notificationLogsDB.NotificationLogTable.grantReadWriteData(
      dynamoLoggerHttp
    );
    commonStack.userPreferencesDdb.UserPreferencesDdb.grantReadWriteData(
      sendEmail
    );

    //give dynamoLogger permission to invoke saveActiveNotifications
    websocketGwStack.saveActiveNotification.grantInvoke(dynamoLoggerHttp);

    // give dynamoLogger permissions to invoke sendEmail lambda
    sendEmail.grantInvoke(dynamoLoggerHttp);
  }
}
