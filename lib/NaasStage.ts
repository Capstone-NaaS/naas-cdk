import { Construct } from "constructs";
import { Stage, StageProps } from "aws-cdk-lib";
import { WebSocketGWStack } from "./stacks/WebSocketGWStack";

// Define the stage
export class NaasStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // Add both stacks to the stage
    new WebSocketGWStack(this, "WebSocketGWStack-test", { env: props!.env });
  }
}
