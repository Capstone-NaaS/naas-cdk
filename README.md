# CDK for the notification as a service

This CDK project will automatically deploy AWS resources to the cloud.

## Requirements

- Install AWS CLI (see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))

- Install AWS CDK CLI

  ```bash
  npm install -g aws-cdk
  ```

## Commands

`cdk synth` to convert the CDK code to CloudFormation template.

`cdk deploy` to deploy all defined resources.

`cdk destroy` to destroy all deployed resources.

## Current Resources

| Resource | Name                     | Description             |
| -------- | ------------------------ | ----------------------- |
| DynamoDB | `notification-users`     | Stores user attributes. |
| S3       | `notification-logs-test` | Stores logs.            |
