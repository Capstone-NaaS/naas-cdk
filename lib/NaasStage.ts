import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";
import { HttpGWStack } from "./stacks/HttpGWStack";

// Define the stage
export class NaasStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // Add websocket api gateway to stage
    const websocketGwStack = new WebSocketGWStack(
      this,
      "WebSocketGWStack-test-k",
      { env: props?.env }
    );

    // Add http api gateway to stage
    new HttpGWStack(this, "HttpGWStack-test-k", websocketGwStack, {
      env: props?.env,
    });
  }
}
