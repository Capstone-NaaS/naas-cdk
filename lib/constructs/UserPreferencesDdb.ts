import { aws_dynamodb, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export interface CustomProps {
  stageName: string;
}

export class UserPreferencesDdb extends Construct {
  UserPreferencesDdb: aws_dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CustomProps) {
    super(scope, id);

    const stageName = props?.stageName || "defaultStage";

    const userPreferencesDdb = new aws_dynamodb.TableV2(
      this,
      `UserPreferencesTable-${stageName}`,
      {
        tableName: `UserPreferencesTable-${stageName}`,
        partitionKey: {
          name: "user_id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        billing: aws_dynamodb.Billing.onDemand(),
        removalPolicy: RemovalPolicy.DESTROY,
      }
    );

    this.UserPreferencesDdb = userPreferencesDdb;
  }
}
