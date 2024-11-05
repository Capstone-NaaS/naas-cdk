import { aws_dynamodb, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export interface CustomProps {
  stageName: string;
}

export class UserAttributesDb extends Construct {
  UserAttributesTable: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CustomProps) {
    super(scope, id);

    const stageName = props?.stageName || "defaultStage";

    const UserAttributesTable = new aws_dynamodb.TableV2(
      this,
      `UserAttributesTable-${stageName}`,
      {
        tableName: `UserAttributesTable-${stageName}`,
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    this.UserAttributesTable = UserAttributesTable;
  }
}
