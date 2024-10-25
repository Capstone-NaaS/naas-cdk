import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";

export class ConnectionIDddb extends Construct {
  ConnectionIdTable: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ConnectionIdTable = new aws_dynamodb.TableV2(
      this,
      "ConnectionIdTable-test",
      {
        tableName: "ConnectionIdTable-test",
        partitionKey: {
          name: "connectionId",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    this.ConnectionIdTable = ConnectionIdTable;
  }
}
