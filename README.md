# Telegraph CDK

This CDK will automatically deploy Telegraph's AWS resources to the cloud.

The CDK is designed to be run by [Telegraph CLI](https://github.com/telegraph-notify/telegraph-cli). It may run on its own if the proper configuration steps are taken. Please see the CLI page for more detail.

## Requirements

- Install AWS CLI (see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))

- Install AWS CDK CLI

  ```bash
  npm install -g aws-cdk
  ```

## Commands

| Command                                        | Description                                           |
| ---------------------------------------------- | ----------------------------------------------------- |
| `cdk synth`                                    | Convert the CDK code to CloudFormation template.      |
| `cdk deploy "prod/*" --require-approval never` | Deploy all defined resources in the **prod** stage.   |
| `cdk destroy "prod/*"`                         | Destroy all deployed resources in the **prod** stage. |

## Constructs

| Construct            | Description                                   |
| -------------------- | --------------------------------------------- |
| `ActiveNotifDdb`     | DynamoDB table to store active notifications. |
| `ConnectionIDddb`    | DynamoDB table to store connection IDs.       |
| `NotificationLogDb`  | DynamoDB table to store notification logs.    |
| `UserAttributesDb`   | DynamoDB table to store user attributes.      |
| `UserPreferencesDdb` | DynamoDB table to store user preferences.     |

## Stacks

| Stack           | Description                                           |
| --------------- | ----------------------------------------------------- |
| `CommonStack`   | Stack created at the beginning for shared resources.  |
| `DynamoLogging` | Adding notification logs to DynamoDB table.           |
| `HttpGW`        | HTTP API Gateway for accepting REST endpoints.        |
| `SesStack`      | Uses SES to send email notifications                  |
| `WebSocketGW`   | WebSocket API Gateway for communicating with clients. |

## Resources

| Resource    | Name                      | Description                                                              |
| ----------- | ------------------------- | ------------------------------------------------------------------------ |
| API Gateway | `ApiGwSocket`             | WebSocket API gateway.                                                   |
| API Gateway | `HttpApi`                 | HTTP API gateway.                                                        |
| DynamoDB    | `ActiveNotificationTable` | Stores active notifications.                                             |
| DynamoDB    | `ConnectionIdTable`       | Stores current WS connection information.                                |
| DynamoDB    | `NotificationLogDb`       | Stores logs of notifications.                                            |
| DynamoDB    | `UserAttributesDb`        | Stores user attributes.                                                  |
| DynamoDB    | `UserPreferencesDdb`      | Stores user preferences.                                                 |
| Lambda      | `dashboardAuthorizer`     | Authorizes API calls sent by the dashboard.                              |
| Lambda      | `httpAuthorizer`          | Authorizes API calls sent by the backend SDK.                            |
| Lambda      | `getDLQ`                  | Retrieves all messages in the DLQ.                                       |
| Lambda      | `fetchNotifLogsFunctions` | Retrieves all notification logs.                                         |
| Lambda      | `processRequest`          | Lambda that processes all requests to send a notification out to a user. |
| Lambda      | `dynamoLogger`            | Logs notification to DynamoDB table.                                     |
| Lambda      | `saveActionNotification`  | Adds a notification to the DynamoDB of active notifications.             |
| Lambda      | `sendInitialData`         | Sends stored data to the client on initial log in.                       |
| Lambda      | `updateNotification`      | Updates the status of an active notification.                            |
| Lambda      | `updatePreference`        | Updates the notification preferences of a user.                          |
| Lambda      | `userFunctions`           | Route handler for the `/user` route in the HTTP API Gateway.             |
| Lambda      | `websocketAuthorizer`     | Lambda authorizer for the `$connect` route in the WS API Gateway.        |
| Lambda      | `websocketBroadcast`      | Lambda to handle websocket `broadcast` route.                            |
| Lambda      | `websocketConnect`        | Lambda to handle websocket `$connect` route.                             |
| Lambda      | `websocketDisconnect`     | Lambda to handle websocket `$disconnect` route.                          |
| Lambda      | `sendEmail`               | Lambda to trigger SES.                                                   |
| Lambda      | `sendSlack`               | Lambda to send Slack webhook.                                            |
| SES         | --                        | SES identity to use as sender when sending email notifications.          |
| SQS         | `notificationQueue`       | Queue to handle sending notifications to users.                          |
| SQS         | `DeadLetterQueue`         | DLQ for notifications that fail to send.                                 |
