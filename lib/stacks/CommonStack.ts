import {
  aws_lambda,
  aws_lambda_nodejs,
  aws_logs,
  aws_sqs,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { NotificationLogDb } from "../constructs/NotificationLogDb";
import { UserAttributesDb } from "../constructs/UserAttributesDb";
import { UserPreferencesDdb } from "../constructs/UserPreferencesDdb";
import { randomUUID } from "node:crypto";
import path = require("path");

interface CommonStackProps extends StackProps {
  stageName: string;
}

export class CommonStack extends Stack {
  // need to share logging lambda and user attributes
  public readonly notificationLogsDB: NotificationLogDb;
  public readonly userPreferencesDdb: UserPreferencesDdb;
  public readonly userAttributesDB: UserAttributesDb;
  public readonly processRequest: aws_lambda_nodejs.NodejsFunction;
  public readonly SAVE_NOTIFICATION_FN: string;
  public readonly loggerQueue: aws_sqs.Queue;
  public readonly dlq: aws_sqs.Queue;

  constructor(scope: Construct, id: string, props: CommonStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";

    const SAVE_NOTIFICATION_FN = `${stageName}-WebSocketGWStac-saveActiveNotification-${randomUUID().slice(
      0,
      6
    )}`;
    this.SAVE_NOTIFICATION_FN = SAVE_NOTIFICATION_FN;

    // create dynamo db table to hold notification logs
    const notificationLogsDB = new NotificationLogDb(
      this,
      `NotificationLogsTable-${stageName}`,
      {
        stageName,
      }
    );
    this.notificationLogsDB = notificationLogsDB;

    // create dynamo db table to hold user preferences logs
    const userPreferencesDdb = new UserPreferencesDdb(
      this,
      `UserPreferencesTable-${stageName}`,
      {
        stageName,
      }
    );
    this.userPreferencesDdb = userPreferencesDdb;

    // create user attributes table
    const userAttributesDB = new UserAttributesDb(
      this,
      `UserAttributesTable-${stageName}`,
      {
        stageName,
      }
    );
    this.userAttributesDB = userAttributesDB;

    // create DLQ
    const dlq = new aws_sqs.Queue(this, `deadLetterQueue-${stageName}`, {
      queueName: `DeadLetterQueue-${stageName}`,
      retentionPeriod: Duration.days(14),
      visibilityTimeout: Duration.seconds(1),
    });
    this.dlq = dlq;

    // create LoggerQueue
    const loggerQueue = new aws_sqs.Queue(
      this,
      `notificationQueue-${stageName}`,
      {
        visibilityTimeout: Duration.seconds(30), // Optional: Customize visibility timeout
        receiveMessageWaitTime: Duration.seconds(6),
        deadLetterQueue: {
          queue: dlq,
          maxReceiveCount: 3,
        },
      }
    );
    this.loggerQueue = loggerQueue;

    // create lambda to process notification requests from HTTP Gateway
    const processRequest = new aws_lambda_nodejs.NodejsFunction(
      this,
      `processRequest-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../../lambdas/requestProcessing/processRequest.ts"
        ),
        environment: {
          USER_ATTRIBUTES_TABLE: userAttributesDB.UserAttributesTable.tableName,
          QUEUE_URL: loggerQueue.queueUrl,
        },
        timeout: Duration.seconds(10),
        logRetention: aws_logs.RetentionDays.ONE_MONTH,
      }
    );
    this.processRequest = processRequest;

    // grant permission to processRequest lambda to send message to SQS
    loggerQueue.grantSendMessages(processRequest);

    // grant permission to processRequest to access user attributes table
    userAttributesDB.UserAttributesTable.grantReadData(processRequest);
  }
}
