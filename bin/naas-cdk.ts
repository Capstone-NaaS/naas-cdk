#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { NaasStage } from "../lib/NaasStage";

const app = new App();

new NaasStage(app, "dev-chris", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new NaasStage(app, "dev-erin", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new NaasStage(app, "dev-frances", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new NaasStage(app, "dev-kwang", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
