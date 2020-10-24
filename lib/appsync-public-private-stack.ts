import * as appsync from "@aws-cdk/aws-appsync";
import * as cognito from "@aws-cdk/aws-cognito";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as iam from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";
import { FederatedPrincipals } from "cdk-constants";
import { pathFromRoot } from "./utils/utils";

export class AppSyncPublicPrivateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(
      this,
      "AppSyncPublicPrivateUserPool",
      {
        passwordPolicy: {
          minLength: 6,
          requireDigits: false,
          requireLowercase: false,
          requireSymbols: false,
          requireUppercase: false
        },
        selfSignUpEnabled: true
      }
    );
    const userPoolClient = new cognito.UserPoolClient(
      this,
      "AppSyncPublicPrivateUserPoolClient",
      {
        userPool,
        authFlows: {
          userPassword: true,
          userSrp: true
        },
        generateSecret: false,
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO
        ]
      }
    );

    const identityPool = new cognito.CfnIdentityPool(
      this,
      "AppSyncPublicPrivateIdentityPool",
      {
        allowUnauthenticatedIdentities: true,
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName
          }
        ]
      }
    );

    const unauthenticatedRole = new iam.Role(
      this,
      "cognitoUnauthenticatedRole",
      {
        assumedBy: new iam.FederatedPrincipal(
          FederatedPrincipals.COGNITO_IDENTITY,
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated"
            }
          },
          "sts:AssumeRoleWithWebIdentity"
        )
      }
    );

    const authenticatedRole = new iam.Role(
      this,
      "aaaa_cognitoAuthenticatedRole",
      {
        assumedBy: new iam.FederatedPrincipal(
          FederatedPrincipals.COGNITO_IDENTITY,
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "authenticated"
            }
          },
          "sts:AssumeRoleWithWebIdentity"
        )
      }
    );

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      "AppSyncPublicPrivateRoleAttachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: unauthenticatedRole.roleArn,
          authenticated: authenticatedRole.roleArn
        }
      }
    );

    // appsync stuff
    const api = new appsync.GraphqlApi(this, "Api", {
      schema: appsync.Schema.fromAsset(pathFromRoot("schema.graphql")),
      name: "PublicPrivateAppSyncApi",
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool
          }
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM
          }
        ]
      }
    });

    const dataTable = new dynamodb.Table(this, "ApiTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING }
    });

    const tableDataSource = api.addDynamoDbDataSource(
      "ApiDataSource",
      dataTable
    );

    tableDataSource.createResolver({
      typeName: "Query",
      fieldName: "posts",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList()
    });

    tableDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "post",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition("id").auto(),
        appsync.Values.projecting()
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem()
    });

    api.grantQuery(unauthenticatedRole, "posts");
    // api.grantQuery(authenticatedRole, "posts");

    new cdk.CfnOutput(this, "userPoolId", {
      value: userPool.userPoolId
    });
    new cdk.CfnOutput(this, "userPoolWebClientId", {
      value: userPoolClient.userPoolClientId
    });
    new cdk.CfnOutput(this, "identityPoolId", {
      value: identityPool.ref
    });

    new cdk.CfnOutput(this, "aws_appsync_graphqlEndpoint", {
      value: api.graphqlUrl
    });
    new cdk.CfnOutput(this, "aws_appsync_authenticationType", {
      value: appsync.AuthorizationType.USER_POOL
    });
    new cdk.CfnOutput(this, "graphqlId", {
      value: api.apiId
    });
  }
}
