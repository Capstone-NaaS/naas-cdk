import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export class ActiveNotifDdb extends Construct {
  ActiveNotifDdb: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ActiveNotifDdb = new aws_dynamodb.TableV2(
      this,
      "ActiveNotificationTable-test-dev",
      {
        tableName: "ActiveNotificationTable-test-dev",
        partitionKey: {
          name: "user_id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "created_at",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
        globalSecondaryIndexes: [
          {
            indexName: "notification_id-index",
            partitionKey: {
              name: "notification_id",
              type: aws_dynamodb.AttributeType.STRING,
            },
            projectionType: aws_dynamodb.ProjectionType.ALL,
          },
        ],
      }
    );

    this.ActiveNotifDdb = ActiveNotifDdb;
  }
}
