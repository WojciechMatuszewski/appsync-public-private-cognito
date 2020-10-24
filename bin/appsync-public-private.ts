#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { AppSyncPublicPrivateStack } from "../lib/appsync-public-private-stack";

const app = new cdk.App();
new AppSyncPublicPrivateStack(app, "AppSyncPublicPrivate", {
  env: { region: "eu-central-1" }
});
