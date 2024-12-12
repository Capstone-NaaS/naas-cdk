#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { TelegraphStage } from "../lib/TelegraphStage";

const app = new App();

new TelegraphStage(app, "prod", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
