import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { Stack, RemovalPolicy, StackProps } from "aws-cdk-lib";

export class DynamoDBStack extends Stack {
  notificationUsersTable: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const notificationUsersTable = new dynamodb.TableV2(
      this,
      "NotificationUsersTable",
      {
        tableName: "notification-users-test",
        partitionKey: {
          name: "id",
          type: dynamodb.AttributeType.NUMBER,
        },
        billing: dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    this.notificationUsersTable = notificationUsersTable;
  }
}
