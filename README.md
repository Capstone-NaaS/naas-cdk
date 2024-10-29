# CDK for the notification as a service

This CDK project will automatically deploy AWS resources to the cloud.

## Requirements

- Install AWS CLI (see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))

- Install AWS CDK CLI

  ```bash
  npm install -g aws-cdk
  ```

## Commands

| Command                      | Description                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| `cdk synth`                  | Convert the CDK code to CloudFormation template.            |
| `cdk deploy "dev-{name}/*"`  | Deploy all defined resources in the **dev-{name}** stage.   |
| `cdk destroy "dev-{name}/*"` | Destroy all deployed resources in the **dev-{name}** stage. |

## Constructs

| Construct         | Description                             |
| ----------------- | --------------------------------------- |
| `ConnectionIDddb` | DynamoDB table to store connection IDs. |

## Stacks

| Stack         | Description                                           |
| ------------- | ----------------------------------------------------- |
| `WebSocketGW` | WebSocket API Gateway for communicating with clients. |
| `HttpGW`      | HTTP API Gateway for accepting REST endpoints.        |
| `S3Logging`   | Adding notification logs to S3 bucket.                |

## Resources

| Resource    | Name                      | Description                                                  |
| ----------- | ------------------------- | ------------------------------------------------------------ |
| API Gateway | `ApiGwSocket`             | WebSocket API gateway.                                       |
| API Gateway | `HttpApi`                 | HTTP API gateway.                                            |
| DynamoDB    | `ActiveNotificationTable` | Stores active notifications.                                 |
| DynamoDB    | `ConnectionIdTable`       | Stores current WS connection information.                    |
| Lambda      | `saveActionNotification`  | Adds a notification to the DynamoDB of active notifications. |
| Lambda      | `s3LogsBucket`            | Logs notification to S3 bucket.                              |
| Lambda      | `updateNotification`      | Updates the status of an active notification.                |
| Lambda      | `websocketConnect`        | Lambda to handle websocket `$connect` route.                 |
| Lambda      | `websocketDisconnect`     | Lambda to handle websocket `$disconnect` route.              |
| Lambda      | `websocketBroadcast`      | Lambda to handle websocket `broadcast` route.                |
| S3 Bucket   | `notification-logs`       | Stores logs of notifications.                                |
