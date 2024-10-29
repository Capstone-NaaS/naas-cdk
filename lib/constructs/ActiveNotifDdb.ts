import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export interface CustomProps {
  stageName: string;
}

export class ActiveNotifDdb extends Construct {
  ActiveNotifDdb: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CustomProps) {
    super(scope, id);

    const stageName = props?.stageName || "defaultStage";

    const ActiveNotifDdb = new aws_dynamodb.TableV2(
      this,
      `ActiveNotificationTable-${stageName}`,
      {
        tableName: `ActiveNotificationTable-${stageName}`,
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
