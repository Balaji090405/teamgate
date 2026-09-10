# TeamGate

Role-based project tracker. Built strictly to the assignment's fixed stack:
Next.js 15 + TS (frontend) · AWS Cognito (login) · API Gateway HTTP API (front door) ·
Lambda Node 22 + TS (logic) · DynamoDB single table (data) · AWS CDK/TypeScript (infra).
Region: `ap-south-1`. No NAT Gateway / EC2 / RDS anywhere in this stack.

## Permission matrix (enforced in `infra/lambda/handler.ts`, not in the UI)

| Action | Admin | Manager | Employee |
|---|---|---|---|
| GET /projects | ✅ | ✅ | ✅ |
| POST /projects | ✅ | ✅ | ❌ 403 |
| PUT /projects/{id} | ✅ | ✅ | ❌ 403 |
| DELETE /projects/{id} | ✅ | ❌ 403 | ❌ 403 |
| PUT /users/{id}/role | ✅ | ❌ 403 | ❌ 403 |

## 1. Deploy the infra

```bash
cd infra
npm install
npm run build
cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1   # one-time only, skip if already done
cdk deploy
```

Note the four `CfnOutput` values printed at the end: `ApiUrl`, `UserPoolId`,
`UserPoolClientId`, `TableName`. You need all four next.

## 2. Create the three test users (one per role)

```bash
POOL_ID=<UserPoolId from output>

for user in admin manager employee; do
  aws cognito-idp admin-create-user \
    --user-pool-id $POOL_ID \
    --username ${user}@test.com \
    --user-attributes Name=email,Value=${user}@test.com Name=email_verified,Value=true \
    --temporary-password 'Temp1234!' \
    --message-action SUPPRESS

  aws cognito-idp admin-set-user-password \
    --user-pool-id $POOL_ID \
    --username ${user}@test.com \
    --password 'Passw0rd!' \
    --permanent
done

aws cognito-idp admin-add-user-to-group --user-pool-id $POOL_ID --username admin@test.com --group-name Admin
aws cognito-idp admin-add-user-to-group --user-pool-id $POOL_ID --username manager@test.com --group-name Manager
aws cognito-idp admin-add-user-to-group --user-pool-id $POOL_ID --username employee@test.com --group-name Employee
```

## 3. Get a JWT and test with curl (do this before touching the frontend)

```bash
CLIENT_ID=<UserPoolClientId from output>
API_URL=<ApiUrl from output>   # no trailing slash

get_token() {
  aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id $CLIENT_ID \
    --auth-parameters USERNAME=$1,PASSWORD='Passw0rd!' \
    --query 'AuthenticationResult.IdToken' --output text
}

ADMIN_TOKEN=$(get_token admin@test.com)
MANAGER_TOKEN=$(get_token manager@test.com)
EMPLOYEE_TOKEN=$(get_token employee@test.com)

# Employee tries to create a project -> expect 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API_URL/projects" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}'

# Manager creates a project -> expect 201
curl -X POST "$API_URL/projects" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}'

# Manager tries to delete -> expect 403
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$API_URL/projects/<id>" \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Admin deletes -> expect 200
curl -X DELETE "$API_URL/projects/<id>" -H "Authorization: Bearer $ADMIN_TOKEN"

# No token at all -> expect 401 (API Gateway layer, before Lambda even runs)
curl -s -o /dev/null -w "%{http_code}\n" -X GET "$API_URL/projects"
```

Confirm all rows of the permission matrix behave correctly here before writing
any frontend code — it's much faster to debug at this layer.

## 4. Frontend

Not built yet — next step once the above is deployed and passing. Will live in
`frontend/` as a Next.js 15 App Router + TypeScript + Tailwind app, using the
same `ApiUrl` / `UserPoolId` / `UserPoolClientId` values above.

## Teardown

```bash
cd infra
cdk destroy
```
