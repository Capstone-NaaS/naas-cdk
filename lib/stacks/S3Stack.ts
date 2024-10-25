import { Stack, StackProps, aws_s3 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class S3Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // L2 construct of an S3 Bucket
    const level2S3Bucket = new aws_s3.Bucket(this, "notification-logs-test2", {
      bucketName: "notification-logs-test2",
      versioned: true,
    });
  }
}
