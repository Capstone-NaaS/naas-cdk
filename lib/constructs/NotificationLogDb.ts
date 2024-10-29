import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export interface CustomProps {
  stageName: string;
}

export class NotificationLogDb extends Construct {
  NotificationLogTable: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CustomProps) {
    super(scope, id);

    const stageName = props?.stageName || "defaultStage";

    const NotificationLogTable = new aws_dynamodb.TableV2(
      this,
      `NotificationLogsTable-${stageName}`,
      {
        tableName: `NotificationLogsTable-${stageName}`,
        partitionKey: {
          name: "log_id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "notification_id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
        globalSecondaryIndexes: [
          {
            indexName: "notification_created_at-index",
            partitionKey: {
              name: "created_at",
              type: aws_dynamodb.AttributeType.STRING,
            },
            projectionType: aws_dynamodb.ProjectionType.ALL,
          },
        ],
      }
    );

    this.NotificationLogTable = NotificationLogTable;
  }
}
