TeamGate:
TeamGate is a small role-based project tracker built for the AWS Knowledge transfer task. It allows authenticated staff members to
view projects while enforcing different permissions for Admin, Manager,
and Employee roles.

Live Demo:

Production: https://teamgate.vercel.app/
GitHub: https://github.com/Balaji090405/teamgate

Architecture:

User
  ↓
Vercel
  ↓
Next.js 15 + TypeScript + Tailwind CSS
  ↓
Amazon Cognito → JWT
  ↓
API Gateway HTTP API
  ↓
AWS Lambda (Node.js 22)
  ↓
Amazon DynamoDB

The application follows the security principle "UI hides, server
denies." The frontend hides unavailable actions, but the backend
independently enforces authorization and returns 403 Forbidden for
unauthorized API requests.

Features:

Cognito-managed authentication

JWT authentication and API authorization

Admin, Manager, and Employee roles

Project listing, creation, editing, and deletion

Admin-only user management and role changes

Responsive Tailwind CSS interface

Serverless AWS backend

Vercel production deployment

Role Permissions:

Action               Admin   Manager   Employee

View projects         ✅       ✅         ✅
Create projects       ✅       ✅         ❌
Edit projects         ✅       ✅         ❌
Delete projects       ✅       ❌         ❌
View users            ✅       ❌         ❌
Change user roles     ✅       ❌         ❌

The backend determines the caller's role from the verified Cognito
cognito:groups claim. It does not trust a role supplied by the request
body or URL.

Technology Stack:

Frontend

Next.js 15

TypeScript

App Router

Tailwind CSS

amazon-cognito-identity-js

AWS Backend

Amazon Cognito

API Gateway HTTP API

AWS Lambda

Node.js 22

TypeScript

Amazon DynamoDB

AWS CDK with TypeScript

AWS IAM

Deployment

Frontend: Vercel

Backend infrastructure: AWS CDK in ap-south-1

The project does not use EC2, RDS, or NAT Gateway.

Project Structure:

teamgate/
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   └── page.tsx
│   ├── lib/
│   │   └── auth.ts
│   ├── public/
│   ├── package.json
│   └── .gitignore
├── infra/
│   ├── bin/
│   │   └── teamgate.ts
│   ├── lambda/
│   │   └── handler.ts
│   ├── lib/
│   │   └── teamgate-stack.ts
│   ├── cdk.json
│   └── package.json
└── README.md

AWS Components:

Amazon Cognito

Cognito provides managed user authentication through a User Pool with
these groups:

Admin
Manager
Employee

After authentication, Cognito issues JWT tokens. The frontend sends the
token using:

Authorization: Bearer <JWT>

API Gateway:

The application uses an HTTP API with JWT authorization.

Method   Endpoint             Purpose

GET      /users             List users --- Admin only
GET      /projects          List projects
POST     /projects          Create project --- Admin/Manager
PUT      /projects/{id}     Edit project --- Admin/Manager
DELETE   /projects/{id}     Delete project --- Admin
PUT      /users/{id}/role   Change role --- Admin

AWS Lambda:

Lambda contains the backend business logic. It:

Reads the authenticated Cognito group.

Determines the caller's role.

Checks authorization.

Performs the requested DynamoDB operation.

Uses Cognito administration APIs for role changes.

Returns 403 Forbidden when the authenticated user lacks
permission.

DynamoDB:

TeamGate uses one DynamoDB table with:

Partition key: PK
Sort key:      SK

A Global Secondary Index is also configured:

GSI1
Partition key: GSI1PK
Sort key:      GSI1SK

The table uses PAY_PER_REQUEST billing.

IAM:

Lambda is granted the permissions required for DynamoDB access and
Cognito user/group administration.

Security Model:

Authentication and authorization are separate.

Cognito
   ↓
JWT
   ↓
API Gateway JWT validation
   ↓
Lambda role/permission check
   ↓
DynamoDB operation

For example:

Employee → POST /projects
              ↓
           Lambda
              ↓
       Permission check
              ↓
        403 Forbidden

Therefore, hiding a button is only a user-interface convenience. The
backend remains the source of truth for authorization.

Local Development:

Prerequisites

Node.js 22+

npm

AWS CLI

AWS CDK

Git

AWS credentials with access to the deployment account

Deploy the infrastructure:

cd infra
npm install
npx cdk bootstrap
npx cdk synth
npx cdk deploy

CDK outputs the API URL, Cognito User Pool ID, Cognito Client ID, and
DynamoDB table name.

Run the frontend

cd frontend
npm install
npm run dev

Open:

http://localhost:3000

Production build

npm run build

Environment Variables

Create frontend/.env.local:

NEXT_PUBLIC_API_URL=<API Gateway URL>
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<Cognito User Pool ID>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<Cognito User Pool Client ID>
NEXT_PUBLIC_AWS_REGION=ap-south-1

Do not commit .env.local to Git. The frontend .gitignore excludes
.env*.

Do not place passwords, AWS secret keys, or other private credentials in
frontend environment variables.

Test Accounts:

The application was tested using Cognito accounts assigned to:

Admin
Manager
Employee

Test passwords are intentionally not documented in this public README.
Share test credentials separately when required.

Testing

Admin

View projects

Create projects

Edit projects

Delete projects

View users

Change user roles

Manager

View projects

Create projects

Edit projects

Cannot delete projects

Cannot access user management

Employee

View projects

Cannot create projects

Cannot edit projects

Cannot delete projects

Cannot manage roles

Unauthorized API operations return:

403 Forbidden

Deployment

AWS Backend

Infrastructure is defined as code in:

infra/lib/teamgate-stack.ts

Deploy with:

cd infra
npx cdk deploy

Vercel Frontend:

Production URL:

https://teamgate.vercel.app/

Vercel configuration:

Root Directory: frontend
Framework: Next.js
Build Command: npm run build

Configure the four NEXT_PUBLIC_* environment variables in the Vercel
project settings.

API Examples

Get projects

GET /projects
Authorization: Bearer <JWT>

Create project:

POST /projects
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Employee Portal",
  "description": "Internal employee management project"
}

Update project:

PUT /projects/{id}
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Updated Project",
  "description": "Updated description"
}

Delete project:

DELETE /projects/{id}
Authorization: Bearer <JWT>

Change a user role:

PUT /users/{id}/role
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "role": "Manager"
}

Only an Admin can successfully perform the role-change operation.

Design Decisions

DynamoDB:

DynamoDB satisfies the required NoSQL/serverless architecture and
integrates directly with Lambda without managing a database server.

API Gateway HTTP API:

HTTP API provides a lightweight serverless API layer and supports JWT
authorization.

Cognito:

Cognito provides managed authentication and JWT-based identity
information without requiring a custom password-storage system.

AWS CDK:

Infrastructure is defined in TypeScript and can be reproduced
consistently without manually creating AWS resources.

Vercel:

Vercel provides a straightforward deployment platform for the Next.js
frontend while the backend remains on AWS.

Cost Considerations:

The architecture avoids expensive always-on infrastructure.

The project does not use:

NAT Gateway

EC2

RDS

DynamoDB uses on-demand capacity, and Lambda/API Gateway are serverless
services.

AWS pricing and free-tier eligibility can change, so usage should be
monitored in the AWS account.

Security Checklist:

Cognito authentication

JWT verification through API Gateway

Server-side role authorization

403 responses for unauthorized operations

Frontend hides unavailable actions

.env.local excluded from Git

No passwords or AWS secret keys stored in frontend source

No EC2

No RDS

No NAT Gateway

Final Result:

TeamGate is a complete serverless role-based project tracker using:

Next.js 15
    +
Tailwind CSS
    +
Amazon Cognito
    +
API Gateway HTTP API
    +
AWS Lambda Node.js 22
    +
DynamoDB
    +
AWS CDK
    +
Vercel

The application is deployed and tested with Admin, Manager, and Employee
roles, including server-side authorization and Admin role management.