#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
// import { AwsCdkTestStack } from "../lib/aws-cdk-test-stack";
import { DynamoDBStack } from "../lib/DynamoDBStack";
import { S3Stack } from "../lib/S3Stack";

const app = new App();

new DynamoDBStack(app, "DynamoDBStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new S3Stack(app, "S3Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
