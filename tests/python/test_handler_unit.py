#!/usr/bin/env python3
"""
Unit tests for Lambda handler logic in infra/lambda/handler.py.
Mocks boto3 DynamoDB and Cognito calls to verify invitation token creation,
ADMIN role invitation rejection, token retrieval, email matching on acceptance,
and explicit workspace creation assigning ADMIN role.
"""

import json
import os
import sys
from unittest.mock import MagicMock, patch

# Add infra/lambda directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../infra/lambda")))

import handler


def make_event(
    method: str = "GET",
    path: str = "/",
    body: dict = None,
    sub: str = "user-123",
    email: str = "test@example.com",
    groups: list[str] = None,
    path_parameters: dict = None,
) -> dict:
    claims = {"sub": sub, "email": email}
    if groups:
        claims["cognito:groups"] = groups

    evt = {
        "requestContext": {
            "http": {"method": method, "path": path},
            "authorizer": {"jwt": {"claims": claims}},
        },
    }
    if body is not None:
        evt["body"] = json.dumps(body)
    if path_parameters:
        evt["pathParameters"] = path_parameters
    return evt


def test_invite_admin_rejected():
    """Verify that attempting to invite a user with role ADMIN returns HTTP 400."""
    with patch.object(handler, "get_effective_role", return_value=({"workspaceId": "ws-1"}, "ADMIN")):
        evt = make_event("POST", "/team", body={"email": "some@example.com", "role": "ADMIN"}, groups=["Admin"])
        res = handler.handle_invite_user(evt)
        assert res["statusCode"] == 400, f"Expected 400, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert "ADMIN cannot be an invitation role" in body["message"]
        print("[PASS] test_invite_admin_rejected")


def test_invite_manager_forbidden():
    """Verify that a MANAGER cannot invite users (HTTP 403)."""
    with patch.object(handler, "get_effective_role", return_value=({"workspaceId": "ws-1"}, "MANAGER")):
        evt = make_event("POST", "/team", body={"email": "some@example.com", "role": "EMPLOYEE"}, groups=["Manager"])
        res = handler.handle_invite_user(evt)
        assert res["statusCode"] == 403, f"Expected 403, got {res['statusCode']}"
        print("[PASS] test_invite_manager_forbidden")


def test_invite_creation_success():
    """Verify that an ADMIN creating a MANAGER or EMPLOYEE invite succeeds with HTTP 201."""
    mock_table = MagicMock()
    with patch.object(handler, "get_effective_role", return_value=({"workspaceId": "ws-1"}, "ADMIN")), \
         patch.object(handler, "table", mock_table), \
         patch.object(handler, "create_activity"):
        evt = make_event("POST", "/team", body={"email": "newuser@example.com", "role": "MANAGER"}, groups=["Admin"])
        res = handler.handle_invite_user(evt)
        assert res["statusCode"] == 201, f"Expected 201, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert "invitation" in body
        inv = body["invitation"]
        assert inv["role"] == "MANAGER"
        assert inv["invitedEmail"] == "newuser@example.com"
        assert "rawToken" in inv
        assert "invitationUrl" in inv
        print("[PASS] test_invite_creation_success")


def test_get_invitation():
    """Verify GET /invitations/{token} returns valid invitation metadata."""
    mock_table = MagicMock()
    mock_table.query.return_value = {
        "Items": [
            {
                "status": "PENDING",
                "expiresAt": "2099-01-01T00:00:00Z",
                "workspaceId": "ws-1",
                "invitedEmail": "invited@example.com",
                "role": "EMPLOYEE",
            }
        ]
    }
    mock_table.get_item.return_value = {"Item": {"name": "Acme Corp"}}

    with patch.object(handler, "table", mock_table):
        res = handler.handle_get_invitation({}, "test-token")
        assert res["statusCode"] == 200, f"Expected 200, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert body["valid"] is True
        assert body["invitedEmail"] == "invited@example.com"
        assert body["role"] == "EMPLOYEE"
        assert body["workspaceName"] == "Acme Corp"
        print("[PASS] test_get_invitation")


def test_accept_invitation_mismatched_email():
    """Verify that accepting an invitation with a mismatched email returns HTTP 403."""
    mock_table = MagicMock()
    token_hash = handler.hash_token("test-raw-token")
    mock_table.query.return_value = {
        "Items": [
            {
                "PK": "WORKSPACE#ws-1",
                "SK": f"INVITATION#{token_hash}",
                "status": "PENDING",
                "expiresAt": "2099-01-01T00:00:00Z",
                "workspaceId": "ws-1",
                "invitedEmail": "correct@example.com",
                "role": "EMPLOYEE",
            }
        ]
    }

    with patch.object(handler, "table", mock_table):
        # User logged in as wrong@example.com
        evt = make_event("POST", "/invitations/accept", body={"token": "test-raw-token"}, email="wrong@example.com")
        res = handler.handle_accept_invitation(evt)
        assert res["statusCode"] == 403, f"Expected 403, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert "does not match invited email" in body["message"]
        print("[PASS] test_accept_invitation_mismatched_email")


def test_accept_invitation_matching_email():
    """Verify that accepting an invitation with a matching email succeeds (HTTP 200)."""
    mock_table = MagicMock()
    mock_cognito = MagicMock()
    token_hash = handler.hash_token("test-raw-token")
    mock_table.query.return_value = {
        "Items": [
            {
                "PK": "WORKSPACE#ws-1",
                "SK": f"INVITATION#{token_hash}",
                "status": "PENDING",
                "expiresAt": "2099-01-01T00:00:00Z",
                "workspaceId": "ws-1",
                "invitedEmail": "correct@example.com",
                "role": "EMPLOYEE",
            }
        ]
    }

    with patch.object(handler, "table", mock_table), \
         patch.object(handler, "cognito", mock_cognito), \
         patch.object(handler, "USER_POOL_ID", "pool-123"), \
         patch.object(handler, "create_activity"):
        evt = make_event("POST", "/invitations/accept", body={"token": "test-raw-token"}, sub="user-999", email="correct@example.com")
        res = handler.handle_accept_invitation(evt)
        assert res["statusCode"] == 200, f"Expected 200, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert body["workspaceId"] == "ws-1"
        assert body["role"] == "EMPLOYEE"
        mock_cognito.admin_add_user_to_group.assert_called_with(
            UserPoolId="pool-123", Username="user-999", GroupName="Employee"
        )
        print("[PASS] test_accept_invitation_matching_email")


def test_create_workspace_assigns_admin():
    """Verify that POST /workspaces creates a new workspace and assigns role ADMIN to the creator."""
    mock_table = MagicMock()
    mock_cognito = MagicMock()

    with patch.object(handler, "table", mock_table), \
         patch.object(handler, "cognito", mock_cognito), \
         patch.object(handler, "USER_POOL_ID", "pool-123"), \
         patch.object(handler, "create_activity"):
        evt = make_event("POST", "/workspaces", body={"name": "My New Company"}, sub="user-owner", email="owner@company.com")
        res = handler.handle_create_workspace(evt)
        assert res["statusCode"] == 201, f"Expected 201, got {res['statusCode']}"
        body = json.loads(res["body"])
        assert body["role"] == "ADMIN"
        assert "workspaceId" in body
        mock_cognito.admin_add_user_to_group.assert_called_with(
            UserPoolId="pool-123", Username="user-owner", GroupName="Admin"
        )
        print("[PASS] test_create_workspace_assigns_admin")


def test_get_team_returns_only_workspace_members():
    """Verify GET /team queries DynamoDB for workspace members and excludes non-workspace users."""
    mock_table = MagicMock()
    mock_cognito = MagicMock()

    # Mock DynamoDB returning 2 members for ws-123
    mock_table.query.return_value = {
        "Items": [
            {
                "PK": "WORKSPACE#ws-123",
                "SK": "MEMBER#user-admin",
                "userId": "user-admin",
                "email": "admin@test.com",
                "role": "ADMIN",
                "isOwner": True,
            },
            {
                "PK": "WORKSPACE#ws-123",
                "SK": "MEMBER#user-manager",
                "userId": "user-manager",
                "email": "manager@test.com",
                "role": "MANAGER",
                "isOwner": False,
            },
        ]
    }
    # Mock admin_get_user throwing or returning attributes
    mock_cognito.admin_get_user.side_effect = Exception("User attributes skipped")

    with patch.object(handler, "get_effective_role", return_value=({"workspaceId": "ws-123"}, "ADMIN")), \
         patch.object(handler, "table", mock_table), \
         patch.object(handler, "cognito", mock_cognito):
        evt = make_event("GET", "/team", sub="user-admin", email="admin@test.com", groups=["Admin"])
        res = handler.handle_get_team(evt)
        assert res["statusCode"] == 200, f"Expected 200, got {res['statusCode']}"
        body = json.loads(res["body"])
        members = body["members"]
        assert len(members) == 2, f"Expected 2 members, got {len(members)}"
        emails = [m["email"] for m in members]
        assert "admin@test.com" in emails
        assert "manager@test.com" in emails
        assert "teamgateadmin@gmail.com" not in emails
        print("[PASS] test_get_team_returns_only_workspace_members")


def run_all_unit_tests():
    print("=" * 70)
    print("Running TeamGate Handler Unit Tests (Mocked AWS)")
    print("=" * 70)
    test_invite_admin_rejected()
    test_invite_manager_forbidden()
    test_invite_creation_success()
    test_get_invitation()
    test_accept_invitation_mismatched_email()
    test_accept_invitation_matching_email()
    test_create_workspace_assigns_admin()
    test_get_team_returns_only_workspace_members()
    print("=" * 70)
    print("ALL HANDLER UNIT TESTS PASSED SUCCESSFULLY! (8/8)")
    print("=" * 70)


if __name__ == "__main__":
    run_all_unit_tests()

