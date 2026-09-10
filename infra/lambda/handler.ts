import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { randomUUID } from 'crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

type Role = 'Admin' | 'Manager' | 'Employee';
const ALL_ROLES: Role[] = ['Admin', 'Manager', 'Employee'];

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Role comes ONLY from the verified JWT's `cognito:groups` claim — never
 * from the request body/path. This is the whole point of the assignment:
 * a client cannot lie about its own role.
 */
function getRole(event: APIGatewayProxyEventV2WithJWTAuthorizer): Role | null {
  const claims = event.requestContext.authorizer.jwt.claims;
  const raw = claims['cognito:groups'];
  if (!raw) return null;

  // API Gateway JWT authorizer passes multi-value claims as a stringified
  // array, e.g. "[Manager]" or as an actual array depending on path — handle both.
  let groups: string[] = [];
  if (Array.isArray(raw)) {
    groups = raw as unknown as string[];
  } else if (typeof raw === 'string') {
    groups = raw.replace(/^\[|\]$/g, '').split(',').map((g) => g.trim()).filter(Boolean);
  }

  const role = groups.find((g) => ALL_ROLES.includes(g as Role)) as Role | undefined;
  return role ?? null;
}

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;
  const role = getRole(event);

  if (!role) {
    return respond(403, { error: 'Forbidden: no role assigned' });
  }

  try {
    if (method === 'GET' && path === '/users') {
      if (role !== 'Admin') {
        return respond(403, {
          error: 'Forbidden: only Admin can list users',
        });
      }

      const result = await cognito.send(
        new ListUsersCommand({
          UserPoolId: USER_POOL_ID,
        }),
      );

      const users = await Promise.all(
        (result.Users ?? []).map(async (user) => {
          const username = user.Username!;

      const groupsResult = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        }),
      );

      const userRole =
      groupsResult.Groups?.find(
        (group) =>
          group.GroupName &&
        ALL_ROLES.includes(group.GroupName as Role),
      )?.GroupName ?? null;

      return {
        id: username,
        username,
        email: user.Attributes?.find(
          (attr) => attr.Name === 'email',
        )?.Value,
        role: userRole,
      };
    }),
  );
      return respond(200, { users });
    }
    // ── GET /projects — Admin, Manager, Employee ─────────────────────
    if (method === 'GET' && path === '/projects') {
      const result = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :p',
          ExpressionAttributeValues: { ':p': 'PROJECT' },
        }),
      );
      return respond(200, { projects: result.Items ?? [] });
    }

    // ── POST /projects — Admin, Manager only ─────────────────────────
    if (method === 'POST' && path === '/projects') {
      if (!['Admin', 'Manager'].includes(role)) {
        return respond(403, { error: 'Forbidden: only Admin or Manager can create projects' });
      }

      const body = JSON.parse(event.body ?? '{}');
      if (!body.name) return respond(400, { error: 'name is required' });

      const id = randomUUID();
      const item = {
        PK: `PROJECT#${id}`,
        SK: 'META',
        GSI1PK: 'PROJECT',
        GSI1SK: `PROJECT#${id}`,
        id,
        name: body.name,
        description: body.description ?? '',
        createdAt: new Date().toISOString(),
      };

      await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return respond(201, { project: item });
    }

    // ── PUT /projects/{id} — Admin, Manager only ─────────────────────
    if (method === 'PUT' && path.startsWith('/projects/')) {
      if (!['Admin', 'Manager'].includes(role)) {
        return respond(403, { error: 'Forbidden: only Admin or Manager can edit projects' });
      }

      const id = event.pathParameters?.id;
      if (!id) return respond(400, { error: 'project id required' });

      const body = JSON.parse(event.body ?? '{}');
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: `PROJECT#${id}`, SK: 'META' },
          UpdateExpression: 'SET #n = :n, description = :d',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':n': body.name,
            ':d': body.description ?? '',
          },
        }),
      );
      return respond(200, { message: 'project updated' });
    }

    // ── DELETE /projects/{id} — Admin ONLY ────────────────────────────
    if (method === 'DELETE' && path.startsWith('/projects/')) {
      if (role !== 'Admin') {
        return respond(403, { error: 'Forbidden: only Admin can delete projects' });
      }

      const id = event.pathParameters?.id;
      if (!id) return respond(400, { error: 'project id required' });

      await ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { PK: `PROJECT#${id}`, SK: 'META' },
        }),
      );
      return respond(200, { message: 'project deleted' });
    }

    // ── PUT /users/{id}/role — Admin ONLY ─────────────────────────────
    if (method === 'PUT' && path.startsWith('/users/') && path.endsWith('/role')) {
      if (role !== 'Admin') {
        return respond(403, { error: 'Forbidden: only Admin can change roles' });
      }

      const targetUsername = event.pathParameters?.id;
      const body = JSON.parse(event.body ?? '{}');
      const newRole = body.role as Role | undefined;

      if (!targetUsername || !newRole || !ALL_ROLES.includes(newRole)) {
        return respond(400, {
          error: 'valid target user id and role (Admin|Manager|Employee) required',
        });
      }

      const current = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: targetUsername,
        }),
      );

      for (const g of current.Groups ?? []) {
        if (g.GroupName && ALL_ROLES.includes(g.GroupName as Role)) {
          await cognito.send(
            new AdminRemoveUserFromGroupCommand({
              UserPoolId: USER_POOL_ID,
              Username: targetUsername,
              GroupName: g.GroupName,
            }),
          );
        }
      }

      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: targetUsername,
          GroupName: newRole,
        }),
      );

      return respond(200, { message: `role updated to ${newRole}` });
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return respond(500, { error: 'Internal server error' });
  }
};