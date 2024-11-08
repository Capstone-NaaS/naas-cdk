import { Construct } from "constructs";
import { Stack, StackProps, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import * as path from "path";

interface SqsStackProps extends StackProps {
  stageName: string;
}

export class SqsStack extends Stack {
  constructor(scope: Construct, id: string, props: SqsStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";

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
      }
    );

    // grant permission to processRequest lambda to send message to SQS
  }
}
