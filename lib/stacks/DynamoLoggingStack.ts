import {
  Stack,
  StackProps,
  aws_lambda_nodejs,
  aws_lambda,
  aws_iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

import { WebSocketGWStack } from "./WebSocketGWStack";
import { CommonStack } from "./CommonStack";
import { SesStack } from "./SesStack";

interface DynamoLoggingStackProps extends StackProps {
  stageName: string;
  commonStack: CommonStack;
  websocketGwStack: WebSocketGWStack;
  sesStack: SesStack;
}

export class DynamoLoggingStack extends Stack {
  // need to share logging lambda
  public readonly dynamoLogger: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: DynamoLoggingStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const commonStack = props.commonStack;
    const websocketGwStack = props.websocketGwStack;
    const sendEmail = props.sesStack.sendEmail;

    // create dynamoLogger lambda
    const dynamoLogger = new aws_lambda_nodejs.NodejsFunction(
      this,
      `dynamoLogger-${stageName}`,
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
          SEND_NOTIFICATION: commonStack.SAVE_NOTIFICATION_FN,
          EMAIL_NOTIFICATION: sendEmail.functionName,
          USER_PREFERENCES_TABLE:
            commonStack.userPreferencesDdb.UserPreferencesDdb.tableName,
        },
        functionName: commonStack.DYNAMO_LOGGER_FN,
      }
    );
    this.dynamoLogger = dynamoLogger;

    //give lambda permission to dynamo
    commonStack.notificationLogsDB.NotificationLogTable.grantReadWriteData(
      dynamoLogger
    );

    dynamoLogger.grantInvoke(websocketGwStack.websocketBroadcast);
    dynamoLogger.grantInvoke(websocketGwStack.updateNotification);
    dynamoLogger.grantInvoke(websocketGwStack.sendInitialData);

    dynamoLogger.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [`arn:aws:lambda:${this.region}:${this.account}:function:*`],
      })
    ); // this gives dynamoLogger the permission to invoke any lambda
  }
}
