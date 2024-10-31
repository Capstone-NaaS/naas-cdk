# CDK for the notification as a service

This CDK project will automatically deploy AWS resources to the cloud.

## Requirements

- Install AWS CLI (see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))

- Install AWS CDK CLI

  ```bash
  npm install -g aws-cdk
  ```

## Commands

| Command                                              | Description                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `cdk synth`                                          | Convert the CDK code to CloudFormation template.            |
| `cdk deploy "dev-{name}/*" --require-approval never` | Deploy all defined resources in the **dev-{name}** stage.   |
| `cdk destroy "dev-{name}/*"`                         | Destroy all deployed resources in the **dev-{name}** stage. |

## Constructs

| Construct           | Description                                   |
| ------------------- | --------------------------------------------- |
| `ActiveNotifDdb`    | DynamoDB table to store active notifications. |
| `ConnectionIDddb`   | DynamoDB table to store connection IDs.       |
| `NotificationLogDb` | DynamoDB table to store notification logs.    |

## Stacks

| Stack           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `CommonStack`   | Stack created at the beginning for shared resources.  |
| `WebSocketGW`   | WebSocket API Gateway for communicating with clients. |
| `HttpGW`        | HTTP API Gateway for accepting REST endpoints.        |
| `DynamoLogging` | Adding notification logs to DynamoDB table.           |

## Resources

| Resource    | Name                      | Description                                                  |
| ----------- | ------------------------- | ------------------------------------------------------------ |
| API Gateway | `ApiGwSocket`             | WebSocket API gateway.                                       |
| API Gateway | `HttpApi`                 | HTTP API gateway.                                            |
| DynamoDB    | `ActiveNotificationTable` | Stores active notifications.                                 |
| DynamoDB    | `ConnectionIdTable`       | Stores current WS connection information.                    |
| DynamoDB    | `NotificationLogDb`       | Stores logs of notifications.                                |
| Lambda      | `saveActionNotification`  | Adds a notification to the DynamoDB of active notifications. |
| Lambda      | `dynamoLogger`            | Logs notification to DynamoDB table.                         |
| Lambda      | `updateNotification`      | Updates the status of an active notification.                |
| Lambda      | `websocketConnect`        | Lambda to handle websocket `$connect` route.                 |
| Lambda      | `websocketDisconnect`     | Lambda to handle websocket `$disconnect` route.              |
| Lambda      | `websocketBroadcast`      | Lambda to handle websocket `broadcast` route.                |
