import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";

import { CommonStack } from "./stacks/CommonStack";
import { DynamoLoggingStack } from "./stacks/DynamoLoggingStack";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";
import { HttpGWStack } from "./stacks/HttpGWStack";
import { SesStack } from "./stacks/SesStack";

// Define the stage
export class NaasStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // Add common stage
    // this includes the dynamo log bucket and SQS
    const commonStack = new CommonStack(this, `CommonStack-${this.stageName}`, {
      env: props?.env,
      stageName: this.stageName,
    });

    // Add SES to stage
    const sesStack = new SesStack(this, `SES-${this.stageName}`, {
      env: props?.env,
      stageName: this.stageName,
      commonStack,
    });

    // Add websocket api gateway to stage
    const websocketGwStack = new WebSocketGWStack(
      this,
      `WebSocketGWStack-${this.stageName}`,
      {
        env: props?.env,
        stageName: this.stageName,
        commonStack,
        sesStack,
      }
    );

    // Add dynamo logging stage
    const dynamoLoggingStack = new DynamoLoggingStack(
      this,
      `DynamoLoggingStack-${this.stageName}`,
      {
        env: props?.env,
        stageName: this.stageName,
        websocketGwStack,
        commonStack,
        sesStack,
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
