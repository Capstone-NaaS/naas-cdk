#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { NaasStage } from "../lib/NaasStage";

const app = new App();

new NaasStage(app, "Dev", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new NaasStage(app, "TestK", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
