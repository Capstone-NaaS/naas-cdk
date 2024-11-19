#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { TelegraphStage } from "../lib/TelegraphStage";

const app = new App();

new TelegraphStage(app, "dev-chris", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new TelegraphStage(app, "dev-erin", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new TelegraphStage(app, "dev-frances", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new TelegraphStage(app, "dev-kwang", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
