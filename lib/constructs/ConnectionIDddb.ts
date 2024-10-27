import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export class ConnectionIDddb extends Construct {
  ConnectionIdTable: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ConnectionIdTable = new aws_dynamodb.TableV2(
      this,
      "ConnectionIdTable-test-k",
      {
        tableName: "ConnectionIdTable-test-k",
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
