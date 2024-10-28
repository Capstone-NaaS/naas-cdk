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

export class S3LoggingStack extends Stack {
  // http s3 logging stack needs to share this lambda with the http gateway
  public readonly logLambdaFunction: aws_lambda_nodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    websocketGwStack: WebSocketGWStack,
    props?: StackProps
  ) {
    super(scope, id, props);

    // get the websocketBroadcast lambda function from the WebSocketGWStack
    const websocketBroadcast = websocketGwStack.websocketBroadcast;

    // create S3 bucket to hold logs
    const logBucket = new aws_s3.Bucket(this, "notification-logs-test-f", {
      bucketName: "notification-logs-test-f",
      publicReadAccess: false, // no public access for read
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY, // destroy bucket when stack deleted
      autoDeleteObjects: true, // empty bucket content when stack delete
    });

    // create lambda function to send and retrieve logs from s3 bucket
    const logLambdaFunction = new aws_lambda_nodejs.NodejsFunction(
      this,
      "loggingToS3-test-f",
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "../../lambdas/s3LogsBucket/s3Logger.ts"),
        environment: {
          WEBSOCKET_BROADCAST_ARN: websocketBroadcast.functionArn,
        },
      }
    );
    this.logLambdaFunction = logLambdaFunction;

    //give permission for the websocketBroadcast lambda to be invoked by logLambdaFunction
    websocketBroadcast.grantInvoke(logLambdaFunction);

    // give lambda permission to s3 bucket
    logBucket.grantRead(logLambdaFunction);
    logBucket.grantPut(logLambdaFunction);
  }
}
