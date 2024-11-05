import { Construct } from "constructs";
import { Stack, StackProps, aws_ses, aws_iam } from "aws-cdk-lib";

interface SesStackProps extends StackProps {
  stageName: string;
}

export class SesStack extends Stack {
  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";

    // // Create an SES Identity email
    // const senderEmail = "frances.h.gray@gmail.com";
    // const emailIdentity = new aws_ses.EmailIdentity(
    //   this,
    //   `EmailIdentity-${stageName}`,
    //   {
    //     emailAddress: senderEmail,
    //   }
    // );

    // iam policy to lambda function
    const sesPolicy = new aws_iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    });
  }
}
