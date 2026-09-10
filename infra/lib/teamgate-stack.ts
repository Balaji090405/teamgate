import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  UserPool,
  UserPoolClient,
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
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new Table(this, 'TeamGateTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    });

    const userPool = new UserPool(this, 'TeamGateUserPool', {
      userPoolName: 'teamgate-user-pool',
      selfSignUpEnabled: false, 
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('TeamGateClient', {
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
    });

    const adminGroup = new CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admin',
      description: 'Full access: create, edit, delete projects, change roles',
    });
    const managerGroup = new CfnUserPoolGroup(this, 'ManagerGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Manager',
      description: 'Can create and edit projects',
    });
    const employeeGroup = new CfnUserPoolGroup(this, 'EmployeeGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Employee',
      description: 'Read-only access to the project list',
    });

    const apiFn = new NodejsFunction(this, 'TeamGateApiFn', {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    table.grantReadWriteData(apiFn);

    apiFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      },
    );

    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);

    const httpApi = new HttpApi(this, 'TeamGateHttpApi', {
      apiName: 'teamgate-api',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'], 
      },
    });

    httpApi.addRoutes({
      path: '/users',
      methods: [HttpMethod.GET],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: '/projects',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: '/projects/{id}',
      methods: [HttpMethod.PUT, HttpMethod.DELETE],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: '/users/{id}/role',
      methods: [HttpMethod.PUT],
      integration,
      authorizer,
    });

    // ── Outputs — you'll need every one of these for the frontend .env
    //     and for the curl tests ─────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}