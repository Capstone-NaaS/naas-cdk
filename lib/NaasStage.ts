import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";

import { CommonStack } from "./stacks/CommonStack";
import { DynamoLoggingStack } from "./stacks/DynamoLoggingStack";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";
import { HttpGWStack } from "./stacks/HttpGWStack";

// Define the stage
export class NaasStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // Add common stage
    // this includes the dynamo log bucket
    const commonStack = new CommonStack(this, `CommonStack-${this.stageName}`, {
      env: props?.env,
      stageName: this.stageName,
    });

    // Add websocket api gateway to stage
    const websocketGwStack = new WebSocketGWStack(
      this,
      `WebSocketGWStack-${this.stageName}`,
      {
        env: props?.env,
        stageName: this.stageName,
        commonStack,
      }
    );

    // Add dynamo logging stack
    // create dynamo logging stack
    const dynamoLoggingStack = new DynamoLoggingStack(
      this,
      `DynamoLoggingStack-${this.stageName}`,
      {
        env: props?.env,
        stageName: this.stageName,
        websocketGwStack,
        commonStack,
      }
    );

    // Add http api gateway to stage
    new HttpGWStack(this, `HttpGWStack-${this.stageName}`, {
      env: props?.env,
      stageName: this.stageName,
      dynamoLoggingStack,
      commonStack,
    });
  }
}
