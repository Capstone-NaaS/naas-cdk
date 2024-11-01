import {
  Stack,
  StackProps,
  aws_lambda_nodejs,
  aws_lambda,
  Lazy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { NotificationLogDb } from "../constructs/NotificationLogDb";
import { UserPreferencesDdb } from "../constructs/UserPreferencesDdb";

interface CommonStackProps extends StackProps {
  stageName: string;
}

export class CommonStack extends Stack {
  // need to share logging lambda
  public readonly notificationLogsDB: NotificationLogDb;
  public readonly userPreferencesDdb: UserPreferencesDdb;

  constructor(scope: Construct, id: string, props: CommonStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";

    // create dynamo db table to hold notification logs
    const notificationLogsDB = new NotificationLogDb(
      this,
      `NotificationLogsTable-${stageName}`,
      {
        stageName,
      }
    );
    this.notificationLogsDB = notificationLogsDB;

    // create dynamo db table to hold notification logs
    const userPreferencesDdb = new UserPreferencesDdb(
      this,
      `UserPreferencesTable-${stageName}`,
      {
        stageName,
      }
    );
    this.userPreferencesDdb = userPreferencesDdb;
  }
}
