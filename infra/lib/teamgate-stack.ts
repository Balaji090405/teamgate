import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import {
  AttributeType,
  BillingMode,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';

import {
  UserPool,
  CfnUserPoolGroup,
  AccountRecovery,
} from 'aws-cdk-lib/aws-cognito';

import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';

import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

import * as path from 'path';

export class TeamGateStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps,
  ) {
    super(scope, id, props);

    /* ---------------------------------------------
       DynamoDB
    --------------------------------------------- */

    const table = new Table(this, 'TeamGateTable', {
      partitionKey: {
        name: 'PK',
        type: AttributeType.STRING,
      },

      sortKey: {
        name: 'SK',
        type: AttributeType.STRING,
      },

      billingMode: BillingMode.PAY_PER_REQUEST,

      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',

      partitionKey: {
        name: 'GSI1PK',
        type: AttributeType.STRING,
      },

      sortKey: {
        name: 'GSI1SK',
        type: AttributeType.STRING,
      },
    });

    /* ---------------------------------------------
       Cognito
    --------------------------------------------- */

    const userPool = new UserPool(
      this,
      'TeamGateUserPool',
      {
        userPoolName: 'teamgate-user-pool',

        selfSignUpEnabled: true,

        signInAliases: {
          email: true,
        },

        autoVerify: {
          email: true,
        },

        accountRecovery:
          AccountRecovery.EMAIL_ONLY,

        passwordPolicy: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: false,
        },

        removalPolicy:
          cdk.RemovalPolicy.DESTROY,
      },
    );

    const userPoolClient =
      userPool.addClient(
        'TeamGateClient',
        {
          authFlows: {
            userSrp: true,
            userPassword: true,
          },
        },
      );

    /* ---------------------------------------------
       Cognito groups
    --------------------------------------------- */

    new CfnUserPoolGroup(
      this,
      'AdminGroup',
      {
        userPoolId:
          userPool.userPoolId,

        groupName: 'Admin',

        description:
          'Workspace administration and project management',
      },
    );

    new CfnUserPoolGroup(
      this,
      'ManagerGroup',
      {
        userPoolId:
          userPool.userPoolId,

        groupName: 'Manager',

        description:
          'Project creation and editing',
      },
    );

    new CfnUserPoolGroup(
      this,
      'EmployeeGroup',
      {
        userPoolId:
          userPool.userPoolId,

        groupName: 'Employee',

        description:
          'Read-only project access',
      },
    );

    /* ---------------------------------------------
       Lambda
    --------------------------------------------- */

    const apiFn =
      new NodejsFunction(
        this,
        'TeamGateApiFn',
        {
          runtime:
            Runtime.NODEJS_22_X,

          entry: path.join('lambda', 'handler.ts'),

          handler: 'handler',

          timeout:
            cdk.Duration.seconds(10),

          memorySize: 256,

          environment: {
            TABLE_NAME:
              table.tableName,

            USER_POOL_ID:
              userPool.userPoolId,
          },

          bundling: {
            minify: true,

            sourceMap: true,

            forceDockerBundling: false,
          },
        },
      );

    /* ---------------------------------------------
       DynamoDB permission
    --------------------------------------------- */

    table.grantReadWriteData(apiFn);

    /* ---------------------------------------------
       Cognito permissions
    --------------------------------------------- */

    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDeleteUser',
        ],

        resources: [
          userPool.userPoolArn,
        ],
      }),
    );

    /* ---------------------------------------------
       JWT Authorizer
    --------------------------------------------- */

    const authorizer =
      new HttpJwtAuthorizer(
        'CognitoAuthorizer',

        `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,

        {
          jwtAudience: [
            userPoolClient.userPoolClientId,
          ],
        },
      );

    /* ---------------------------------------------
       API integration
    --------------------------------------------- */

    const integration =
      new HttpLambdaIntegration(
        'ApiIntegration',
        apiFn,
      );

    /* ---------------------------------------------
       HTTP API
    --------------------------------------------- */

    const httpApi =
      new HttpApi(
        this,
        'TeamGateHttpApi',
        {
          apiName: 'teamgate-api',

          corsPreflight: {
            allowHeaders: [
              'Authorization',
              'Content-Type',
            ],

            allowMethods: [
              CorsHttpMethod.GET,
              CorsHttpMethod.POST,
              CorsHttpMethod.PUT,
              CorsHttpMethod.DELETE,
              CorsHttpMethod.OPTIONS,
            ],

            allowOrigins: ['*'],
          },
        },
      );

    /* ---------------------------------------------
       Routes
    --------------------------------------------- */

    httpApi.addRoutes({
      path: '/me',

      methods: [
        HttpMethod.GET,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/dashboard',

      methods: [
        HttpMethod.GET,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/projects',

      methods: [
        HttpMethod.GET,
        HttpMethod.POST,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/projects/{id}',

      methods: [
        HttpMethod.PUT,
        HttpMethod.DELETE,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/team',

      methods: [
        HttpMethod.GET,
        HttpMethod.POST,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/team/{id}',

      methods: [
        HttpMethod.DELETE,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/team/{id}/role',

      methods: [
        HttpMethod.PUT,
      ],

      integration,

      authorizer,
    });

    httpApi.addRoutes({
      path: '/activity',

      methods: [
        HttpMethod.GET,
      ],

      integration,

      authorizer,
    });

    /* ---------------------------------------------
       Outputs
    --------------------------------------------- */

    new cdk.CfnOutput(
      this,
      'ApiUrl',
      {
        value:
          httpApi.apiEndpoint,
      },
    );

    new cdk.CfnOutput(
      this,
      'UserPoolId',
      {
        value:
          userPool.userPoolId,
      },
    );

    new cdk.CfnOutput(
      this,
      'UserPoolClientId',
      {
        value:
          userPoolClient.userPoolClientId,
      },
    );

    new cdk.CfnOutput(
      this,
      'TableName',
      {
        value:
          table.tableName,
      },
    );
  }
}