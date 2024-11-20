import {
  Stack,
  StackProps,
  aws_lambda_nodejs,
  aws_lambda,
  aws_lambda_event_sources,
  Duration,
  aws_logs,
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
    const loggerQueue = props.commonStack.loggerQueue;

    // create sendSlack lambda
    const sendSlack = new aws_lambda_nodejs.NodejsFunction(
      this,
      `sendSlack-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "../../lambdas/slack/sendSlack.ts"),
        environment: {
          LOG_QUEUE: loggerQueue.queueUrl,
          USER_ATTRIBUTES_TABLE:
            commonStack.userAttributesDB.UserAttributesTable.tableName,
        },
        timeout: Duration.seconds(10),
        logRetention: aws_logs.RetentionDays.ONE_MONTH,
      }
    );

    // grant permission to sendSlack lambda to access UserAttributes DB
    commonStack.userAttributesDB.UserAttributesTable.grantReadWriteData(
      sendSlack
    );

    // grant permission to sendEmail lambda to send message to SQS
    loggerQueue.grantSendMessages(sendSlack);

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
          SLACK_NOTIFICATION: sendSlack.functionName,
        },
        timeout: Duration.seconds(20),
        logRetention: aws_logs.RetentionDays.ONE_MONTH,
      }
    );
    this.dynamoLogger = dynamoLogger;

    //give lambda permission to dynamo
    commonStack.notificationLogsDB.NotificationLogTable.grantReadWriteData(
      dynamoLogger
    );
    commonStack.userPreferencesDdb.UserPreferencesDdb.grantReadData(
      dynamoLogger
    );

    sendEmail.grantInvoke(dynamoLogger);
    sendSlack.grantInvoke(dynamoLogger);

    dynamoLogger.addEventSource(
      new aws_lambda_event_sources.SqsEventSource(loggerQueue, {
        maxBatchingWindow: Duration.seconds(2),
        batchSize: 100,
        maxConcurrency: 10,
        reportBatchItemFailures: true,
      })
    );

    loggerQueue.grantConsumeMessages(dynamoLogger);

    websocketGwStack.saveActiveNotification.grantInvoke(dynamoLogger);
  }
}
