#!/usr/bin/env python3
"""
TeamGate Automated Security & API Test Suite

This test suite verifies backend RBAC authorization rules for TeamGate
by executing real HTTP requests to AWS API Gateway.

Roles & Permissions Matrix:
- ADMIN: GET (200), POST (201), PUT (200), DELETE (200), Role Change (200)
- MANAGER: GET (200), POST (201), PUT (200), DELETE (403), Role Change (403)
- EMPLOYEE: GET (200), POST (403), PUT (403), DELETE (403), Role Change (403)
- UNAUTHENTICATED: GET (401)
"""

import json
import os
import sys
import urllib.error
import urllib.request

# Ensure UTF-8 output encoding for Windows compatibility
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

API_URL = os.environ.get(
    "API_URL",
    "https://zodir33jv0.execute-api.ap-south-1.amazonaws.com",
)
COGNITO_CLIENT_ID = os.environ.get(
    "COGNITO_CLIENT_ID",
    "i2v5g1cputpqod4fj2bp7ivah",
)
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
COGNITO_ENDPOINT = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/"

TEST_USERS = {
    "ADMIN": {
        "email": os.environ.get("ADMIN_EMAIL", "admin@test.com"),
        "password": os.environ.get("ADMIN_PASSWORD", "Admin@123"),
    },
    "MANAGER": {
        "email": os.environ.get("MANAGER_EMAIL", "manager@test.com"),
        "password": os.environ.get("MANAGER_PASSWORD", "Manager@123"),
    },
    "EMPLOYEE": {
        "email": os.environ.get("EMPLOYEE_EMAIL", "employee@test.com"),
        "password": os.environ.get("EMPLOYEE_PASSWORD", "Employee@123"),
    },
}


def get_id_token(email: str, password: str) -> str:
    """Authenticate with AWS Cognito User Pool via USER_PASSWORD_AUTH flow."""
    payload = {
        "AuthFlow": "USER_PASSWORD_AUTH",
        "ClientId": COGNITO_CLIENT_ID,
        "AuthParameters": {
            "USERNAME": email,
            "PASSWORD": password,
        },
    }
    req = urllib.request.Request(
        COGNITO_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["AuthenticationResult"]["IdToken"]
    except Exception as err:
        print(f"FAILED to authenticate user '{email}': {err}")
        raise


def api_request(
    method: str,
    path: str,
    token: str = None,
    body: dict = None,
) -> tuple[int, dict]:
    """Execute HTTP request against API Gateway and return (status_code, response_dict)."""
    url = f"{API_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            try:
                res_body = json.loads(content) if content else {}
            except Exception:
                res_body = {"raw": content}
            return status, res_body
    except urllib.error.HTTPError as err:
        content = err.read().decode("utf-8")
        try:
            res_body = json.loads(content) if content else {}
        except Exception:
            res_body = {"raw": content}
        return err.code, res_body


def run_tests():
    print("=" * 70)
    print("TeamGate API Security & Authorization Test Suite")
    print(f"API Target: {API_URL}")
    print("=" * 70)

    tokens = {}
    print("\n[1/5] Authenticating test accounts...")
    for role, credentials in TEST_USERS.items():
        try:
            tokens[role] = get_id_token(
                credentials["email"], credentials["password"]
            )
            print(f"  [OK] Authenticated {role} ({credentials['email']})")
        except Exception as err:
            print(f"  [FAIL] Failed {role}: {err}")
            sys.exit(1)

    passed = 0
    failed = 0

    def assert_case(
        description: str,
        actual_code: int,
        expected_code: int,
        response_body: dict,
    ):
        nonlocal passed, failed
        if actual_code == expected_code:
            print(f"  [PASS] {description} (HTTP {actual_code})")
            passed += 1
        else:
            print(
                f"  [FAIL] {description} | Expected {expected_code}, got {actual_code} | Body: {response_body}"
            )
            failed += 1

    # -------------------------------------------------------------
    # 2. Test /me Endpoint Role Verification
    # -------------------------------------------------------------
    print("\n[2/5] Testing /me Endpoint & Role Resolution...")
    for role in ["ADMIN", "MANAGER", "EMPLOYEE"]:
        code, body = api_request("GET", "/me", token=tokens[role])
        resolved_role = body.get("workspace", {}).get("role")
        assert_case(
            f"{role} /me returns role '{resolved_role}'",
            code,
            200,
            body,
        )
        if resolved_role != role:
            print(
                f"  [FAIL] ROLE MISMATCH: Expected {role}, resolved {resolved_role}"
            )
            failed += 1
        else:
            print(f"  [PASS] Verified role matches expected: {role}")

    # -------------------------------------------------------------
    # 3. Test ADMIN Workflow (Create, Edit, Delete Project, Change Role)
    # -------------------------------------------------------------
    print("\n[3/5] Testing ADMIN Permissions (Full Control)...")
    code, body = api_request("GET", "/projects", token=tokens["ADMIN"])
    assert_case("ADMIN can GET /projects", code, 200, body)

    code, body = api_request(
        "POST",
        "/projects",
        token=tokens["ADMIN"],
        body={
            "name": "Admin Test Project",
            "description": "Created by Python automated security tests",
            "status": "PLANNING",
        },
    )
    assert_case("ADMIN can POST /projects", code, 201, body)
    admin_project_id = body.get("project", {}).get("id")

    if admin_project_id:
        code, body = api_request(
            "PUT",
            f"/projects/{admin_project_id}",
            token=tokens["ADMIN"],
            body={
                "name": "Admin Updated Project",
                "description": "Updated by Admin in automated test",
                "status": "ACTIVE",
            },
        )
        assert_case("ADMIN can PUT /projects/{id}", code, 200, body)

        code, body = api_request(
            "DELETE",
            f"/projects/{admin_project_id}",
            token=tokens["ADMIN"],
        )
        assert_case("ADMIN can DELETE /projects/{id}", code, 200, body)

    # -------------------------------------------------------------
    # 4. Test MANAGER Permissions & Denial Rules (403 Forbidden)
    # -------------------------------------------------------------
    print("\n[4/5] Testing MANAGER Permissions & 403 Forbidden Rules...")
    code, body = api_request("GET", "/projects", token=tokens["MANAGER"])
    assert_case("MANAGER can GET /projects", code, 200, body)

    code, body = api_request(
        "POST",
        "/projects",
        token=tokens["MANAGER"],
        body={
            "name": "Manager Test Project",
            "description": "Created by Manager in test",
            "status": "PLANNING",
        },
    )
    assert_case("MANAGER can POST /projects", code, 201, body)
    manager_project_id = body.get("project", {}).get("id")

    if manager_project_id:
        code, body = api_request(
            "PUT",
            f"/projects/{manager_project_id}",
            token=tokens["MANAGER"],
            body={
                "name": "Manager Updated Title",
                "description": "Edited by Manager",
                "status": "COMPLETED",
            },
        )
        assert_case("MANAGER can PUT /projects/{id}", code, 200, body)

        # MANAGER MUST BE DENIED DELETE (403 FORBIDDEN)
        code, body = api_request(
            "DELETE",
            f"/projects/{manager_project_id}",
            token=tokens["MANAGER"],
        )
        assert_case(
            "MANAGER DELETE /projects/{id} returns HTTP 403 Forbidden",
            code,
            403,
            body,
        )

        # Clean up project as ADMIN
        api_request("DELETE", f"/projects/{manager_project_id}", token=tokens["ADMIN"])

    # MANAGER MUST BE DENIED ROLE CHANGE (403 FORBIDDEN)
    code, body = api_request(
        "PUT",
        "/team/some-user-id/role",
        token=tokens["MANAGER"],
        body={"role": "ADMIN"},
    )
    assert_case(
        "MANAGER PUT /team/{id}/role returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    # -------------------------------------------------------------
    # 5. Test EMPLOYEE Permissions & Denial Rules (403 Forbidden)
    # -------------------------------------------------------------
    print("\n[5/5] Testing EMPLOYEE Permissions & Unauthenticated Access...")
    code, body = api_request("GET", "/projects", token=tokens["EMPLOYEE"])
    assert_case("EMPLOYEE can GET /projects", code, 200, body)

    code, body = api_request(
        "POST",
        "/projects",
        token=tokens["EMPLOYEE"],
        body={"name": "Forbidden Project", "description": "Should fail"},
    )
    assert_case(
        "EMPLOYEE POST /projects returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    code, body = api_request(
        "PUT",
        "/projects/dummy-id",
        token=tokens["EMPLOYEE"],
        body={"name": "Forbidden Update"},
    )
    assert_case(
        "EMPLOYEE PUT /projects/{id} returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    code, body = api_request(
        "DELETE",
        "/projects/dummy-id",
        token=tokens["EMPLOYEE"],
    )
    assert_case(
        "EMPLOYEE DELETE /projects/{id} returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    code, body = api_request(
        "PUT",
        "/team/dummy-id/role",
        token=tokens["EMPLOYEE"],
        body={"role": "ADMIN"},
    )
    assert_case(
        "EMPLOYEE PUT /team/{id}/role returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    # -------------------------------------------------------------
    # 6. Test TEAM INVITE & DELETE Permissions & Denial Rules
    # -------------------------------------------------------------
    print("\n[6/6] Testing TEAM INVITE & DELETE Authorization Rules...")

    # MANAGER CANNOT INVITE USER (403 FORBIDDEN)
    code, body = api_request(
        "POST",
        "/team",
        token=tokens["MANAGER"],
        body={"email": "tempmanagerinvite@test.com", "role": "EMPLOYEE"},
    )
    assert_case(
        "MANAGER POST /team (invite) returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    # EMPLOYEE CANNOT INVITE USER (403 FORBIDDEN)
    code, body = api_request(
        "POST",
        "/team",
        token=tokens["EMPLOYEE"],
        body={"email": "tempemployeeinvite@test.com", "role": "EMPLOYEE"},
    )
    assert_case(
        "EMPLOYEE POST /team (invite) returns HTTP 403 Forbidden",
        code,
        403,
        body,
    )

    # ADMIN CAN INVITE USER (201 CREATED)
    temp_email = "testinviteuser@test.com"
    code, body = api_request(
        "POST",
        "/team",
        token=tokens["ADMIN"],
        body={"email": temp_email, "name": "Temp Test User", "role": "EMPLOYEE"},
    )
    # Could be 201 or 400 if user already exists from prior run
    if code == 400 and "already exists" in json.dumps(body):
        print(f"  [PASS] ADMIN POST /team user already exists from previous run (HTTP {code})")
        passed += 1
        # Find user ID from GET /team
        _, team_body = api_request("GET", "/team", token=tokens["ADMIN"])
        invited_user_id = next((m["id"] for m in team_body.get("members", []) if m.get("email") == temp_email), None)
    else:
        assert_case("ADMIN POST /team (invite) returns HTTP 201 Created", code, 201, body)
        invited_user_id = body.get("user", {}).get("userId")

    if invited_user_id:
        # MANAGER CANNOT DELETE USER (403 FORBIDDEN)
        code, body = api_request(
            "DELETE",
            f"/team/{invited_user_id}",
            token=tokens["MANAGER"],
        )
        assert_case(
            "MANAGER DELETE /team/{id} returns HTTP 403 Forbidden",
            code,
            403,
            body,
        )

        # EMPLOYEE CANNOT DELETE USER (403 FORBIDDEN)
        code, body = api_request(
            "DELETE",
            f"/team/{invited_user_id}",
            token=tokens["EMPLOYEE"],
        )
        assert_case(
            "EMPLOYEE DELETE /team/{id} returns HTTP 403 Forbidden",
            code,
            403,
            body,
        )

        # ADMIN CAN DELETE USER (200 OK)
        code, body = api_request(
            "DELETE",
            f"/team/{invited_user_id}",
            token=tokens["ADMIN"],
        )
        assert_case(
            "ADMIN DELETE /team/{id} returns HTTP 200 OK",
            code,
            200,
            body,
        )

    print("\n" + "=" * 70)
    print(f"TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
