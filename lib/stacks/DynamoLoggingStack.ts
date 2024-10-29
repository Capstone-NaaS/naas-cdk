import { Stack, StackProps, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { WebSocketGWStack } from "./WebSocketGWStack";
import { NotificationLogDb } from "../constructs/NotificationLogDb";

interface DynamoLoggingStackProps extends StackProps {
  stageName: string;
}

export class DynamoLoggingStack extends Stack {
  // need to share logging lambda
  public readonly dynamoLogger: aws_lambda_nodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    websocketGwStack: WebSocketGWStack,
    props?: DynamoLoggingStackProps
  ) {
    super(scope, id, props);

    const stageName = props?.stageName || "defaultStage";

    // get the websocketBroadcast lambda function from the WebSocketGWStack
    const saveActiveNotification = websocketGwStack.saveActiveNotification;

    // create dynamo db table to hold notification logs
    const notificationLogsDB = new NotificationLogDb(
      this,
      `NotificationLogsTable-${stageName}`,
      {
        stageName,
      }
    );

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
          NOTIFICATION_LOG_TABLE: `NotificationLogsTable-${stageName}`,
          SEND_NOTIFICATION: saveActiveNotification.functionName,
        },
      }
    );
    this.dynamoLogger = dynamoLogger;

    // give permission for saveActiveNotification lambda to be invoked by dynamoLogger
    saveActiveNotification.grantInvoke(dynamoLogger);

    //give lambda permission to dynamo
    notificationLogsDB.NotificationLogTable.grantReadWriteData(dynamoLogger);
  }
}
