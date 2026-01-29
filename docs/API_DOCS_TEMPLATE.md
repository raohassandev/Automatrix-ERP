# API Documentation Template

## Title
- Path: `/api/...`
- Method: `GET/POST/etc.`
- Status: Draft/Complete

## Overview
Describe the endpoint purpose and its place in the stack.

## Request
- Headers
- Query parameters
- Body schema (Zod or JSON)

## Response
- Status codes
- Payload schema
- Examples

## Permissions
- Required NextAuth permissions (e.g., `expenses.view_all`)
- RBAC roles that can call it

## Audit/logging
- Which actions are recorded in `AuditLog`
- Any downstream side effects (wallet update, notifications)

## Acceptance criteria
1. ✅ Endpoint returns 200 when authenticated with proper role
2. ✅ Invalid input returns 400 with errors
3. ✅ Unauthorized requests return 401/403
4. ✅ Audit trail contains a row when action occurs
