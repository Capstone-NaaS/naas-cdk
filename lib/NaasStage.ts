import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";
import { HttpGWStack } from "./stacks/HttpGWStack";
// import { S3LoggingStack } from "./stacks/S3LoggingStack";
import { DynamoLoggingStack } from "./stacks/DynamoLoggingStack";

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
    // const s3LoggingStack = new S3LoggingStack(
    //   this,
    //   `S3LoggingStack-${this.stageName}`,
    //   websocketGwStack,
    //   {
    //     env: props?.env,
    //     stageName: this.stageName,
    //   }
    // );

    // Add DynamoDbLogger to stage
    const dynamoLoggingStack = new DynamoLoggingStack(
      this,
      `DynamoLoggingStack-${this.stageName}`,
      websocketGwStack,
      {
        env: props?.env,
        stageName: this.stageName,
      }
    );

    // Add http api gateway to stage
    new HttpGWStack(this, `HttpGWStack-${this.stageName}`, dynamoLoggingStack, {
      env: props?.env,
      stageName: this.stageName,
    });
  }
}
