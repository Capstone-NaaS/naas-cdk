import { Construct } from "constructs";
import {
  Stack,
  StackProps,
  aws_ses,
  aws_iam,
  aws_lambda_nodejs,
  aws_lambda,
  Duration,
  aws_logs,
} from "aws-cdk-lib";
import { CommonStack } from "./CommonStack";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

interface SesStackProps extends StackProps {
  stageName: string;
  commonStack: CommonStack;
}

export class SesStack extends Stack {
  public readonly sendEmail: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const stageName = props.stageName || "defaultStage";
    const commonStack = props.commonStack;
    const loggerQueue = props.commonStack.loggerQueue;

    // create email sending Lambda
    const sendEmail = new aws_lambda_nodejs.NodejsFunction(
      this,
      `sendEmail-${stageName}`,
      {
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "../../lambdas/email/sendEmail.ts"),
        environment: {
          SENDER_EMAIL: process.env.SENDER_EMAIL!,
          LOG_QUEUE: loggerQueue.queueUrl,
          USER_ATTRIBUTES_TABLE:
            commonStack.userAttributesDB.UserAttributesTable.tableName,
        },
        timeout: Duration.seconds(10),
        logRetention: aws_logs.RetentionDays.ONE_MONTH,
      }
    );
    this.sendEmail = sendEmail;

    // grant permission to sendEmail lambda to access UserAttributes DB
    commonStack.userAttributesDB.UserAttributesTable.grantReadWriteData(
      sendEmail
    );

    // grant permission to sendEmail lambda to send emails with SES
    sendEmail.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: ["*"],
      })
    );

    // grant permission to sendEmail lambda to send message to SQS
    loggerQueue.grantSendMessages(sendEmail);

    new aws_ses.CfnEmailIdentity(this, `SenderEmailIdentity-${stageName}`, {
      emailIdentity: process.env.SENDER_EMAIL!,
    });
  }
}
