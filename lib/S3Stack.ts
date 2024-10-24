import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class S3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // L2 construct of an S3 Bucket
    const level2S3Bucket = new cdk.aws_s3.Bucket(
      this,
      "notification-logs-test",
      {
        bucketName: "notification-logs-test",
        versioned: true,
      }
    );
  }
}
