import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";
import { HttpGWStack } from "./stacks/HttpGWStack";
import { S3LoggingStack } from "./stacks/S3LoggingStack";

// Define the stage
export class NaasStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // Add websocket api gateway to stage
    const websocketGwStack = new WebSocketGWStack(
      this,
      `WebSocketGWStack-${this.stageName}`,
      { env: props?.env, stageName: this.stageName }
    );

    // Add s3Logger to stage
    const s3LoggingStack = new S3LoggingStack(
      this,
      `S3LoggingStack-${this.stageName}`,
      websocketGwStack,
      {
        env: props?.env,
        stageName: this.stageName,
      }
    );

    // Add http api gateway to stage
    new HttpGWStack(this, `HttpGWStack-${this.stageName}`, s3LoggingStack, {
      env: props?.env,
      stageName: this.stageName,
    });
  }
}
