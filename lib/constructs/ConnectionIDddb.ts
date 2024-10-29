import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export interface CustomProps {
  stageName: string;
}

export class ConnectionIDddb extends Construct {
  ConnectionIdTable: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CustomProps) {
    super(scope, id);

    const stageName = props?.stageName || "defaultStage";

    const ConnectionIdTable = new aws_dynamodb.TableV2(
      this,
      `ConnectionIdTable-${stageName}`,
      {
        tableName: `ConnectionIdTable-${stageName}`,
        partitionKey: {
          name: "connectionId",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
        globalSecondaryIndexes: [
          {
            indexName: "user_id-index",
            partitionKey: {
              name: "user_id",
              type: aws_dynamodb.AttributeType.STRING,
            },
            projectionType: aws_dynamodb.ProjectionType.ALL,
          },
        ],
      }
    );

    this.ConnectionIdTable = ConnectionIdTable;
  }
}
