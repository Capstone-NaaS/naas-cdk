import {
  Stack,
  StackProps,
  aws_s3,
  RemovalPolicy,
  aws_lambda_nodejs,
  aws_lambda,
  aws_iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import { WebSocketGWStack } from "./WebSocketGWStack";

interface S3LoggingStackProps extends StackProps {
  stageName: string;
}

export class S3LoggingStack extends Stack {
  // http s3 logging stack needs to share this lambda with the http gateway
  public readonly logLambdaFunction: aws_lambda_nodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    websocketGwStack: WebSocketGWStack,
    props?: S3LoggingStackProps
  ) {
    super(scope, id, props);

    const stageName = props?.stageName || "defaultStage";

    // get the websocketBroadcast lambda function from the WebSocketGWStack
    const saveActiveNotification = websocketGwStack.saveActiveNotification;

    // create S3 bucket to hold logs
    const logBucket = new aws_s3.Bucket(
      this,
      `notification-logs-${stageName}`,
      {
        bucketName: `notification-logs-${stageName}`,
        publicReadAccess: false, // no public access for read
        versioned: true,
        removalPolicy: RemovalPolicy.DESTROY, // destroy bucket when stack deleted
        autoDeleteObjects: true, // empty bucket content when stack delete
      }
    );

    // create lambda function to send and retrieve logs from s3 bucket
    const logLambdaFunction = new aws_lambda_nodejs.NodejsFunction(
      this,
      `loggingToS3-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "../../lambdas/s3LogsBucket/s3Logger.ts"),
        environment: {
          SAVE_ACTIVE_NOTIFICATION: saveActiveNotification.functionName,
          LOG_BUCKET: logBucket.bucketName,
        },
      }
    );
    this.logLambdaFunction = logLambdaFunction;

    //give permission for the saveActiveNotification lambda to be invoked by logLambdaFunction
    saveActiveNotification.grantInvoke(logLambdaFunction);

    // give lambda permission to s3 bucket
    logBucket.grantRead(logLambdaFunction);
    logBucket.grantPut(logLambdaFunction);
  }
}
