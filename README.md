# CDK for the notification as a service

This CDK project will automatically deploy AWS resources to the cloud.

## Requirements

- Install AWS CLI (see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))

- Install AWS CDK CLI

  ```bash
  npm install -g aws-cdk
  ```

## Commands

| Command               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `cdk synth`           | Convert the CDK code to CloudFormation template.     |
| `cdk deploy "Dev/*"`  | Deploy all defined resources in the **Dev** stage.   |
| `cdk destroy "Dev/*"` | Destroy all deployed resources in the **Dev** stage. |

## Constructs

| Construct         | Description                             |
| ----------------- | --------------------------------------- |
| `ConnectionIDddb` | DynamoDB table to store connection IDs. |

## Stacks

| Stack         | Description                                           |
| ------------- | ----------------------------------------------------- |
| `WebSocketGW` | WebSocket API Gateway for communicating with clients. |
| `HttpGW`      | HTTP API Gateway for accepting REST endpoints.        |

## Resources

| Resource    | Name                     | Description                                     |
| ----------- | ------------------------ | ----------------------------------------------- |
| DynamoDB    | `ConnectionIdTable-test` | Stores user attributes.                         |
| API Gateway | `ApiGwSocket-test`       | WebSocket API gateway.                          |
| API Gateway | `HttpApi-test`           | HTTP API gateway.                               |
| Lambda      | `websocketConnect`       | Lambda to handle websocket `$connect` route.    |
| Lambda      | `websocketDisconnect`    | Lambda to handle websocket `$disconnect` route. |
| Lambda      | `websocketBroadcast`     | Lambda to handle websocket `broadcast` route.   |
