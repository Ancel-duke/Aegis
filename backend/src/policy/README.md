# Policy Engine Module

A comprehensive policy evaluation engine for Aegis that handles API access control, self-healing triggers, RBAC enforcement, and immutable audit logging.

## Features

- **Policy Evaluation**: Evaluate policies for API access, self-healing, data access, and resource limits
- **RBAC Support**: Role-based access control with predefined roles (admin, user, auditor)
- **Priority-Based Evaluation**: Policies are evaluated based on priority, with DENY taking precedence
- **Wildcard Matching**: Support for wildcard patterns in actions and resources (`*`, `?`)
- **Immutable Audit Logs**: All policy evaluations are logged in an append-only audit trail
- **Redis Caching**: Optional caching of policy decisions for improved performance
- **Flexible Conditions**: Support for role, user, IP range, time range, and custom metadata conditions

## Architecture

### Entities

1. **Policy**: Stores policy definitions
   - `name`: Policy name
   - `type`: Policy type (api_access, self_healing, data_access, resource_limit)
   - `effect`: Allow or Deny
   - `conditions`: JSON conditions for evaluation
   - `actions`: Array of allowed/denied actions
   - `resources`: Array of affected resources
   - `priority`: Evaluation priority (higher = first)

2. **Role**: Defines user roles
   - `name`: Role name (admin, user, auditor)
   - `permissions`: JSON object of permissions

3. **PolicyAuditLog**: Immutable audit trail
   - `userId`: User who triggered the evaluation
   - `action`: Action attempted
   - `resource`: Resource accessed
   - `result`: Allow, Deny, or Error
   - `context`: Additional context data
   - `appliedPolicies`: List of policies that matched

## API Endpoints

### Policy Evaluation

**POST** `/api/v1/policy/evaluate`

Evaluate a policy decision. This endpoint can be called by AI Engine, API Pods, or other services.

```json
{
  "action": "read",
  "resource": "/api/users",
  "type": "api_access",
  "context": {
    "userId": "user-123",
    "role": "user",
    "ipAddress": "192.168.1.1",
    "metadata": {
      "department": "engineering"
    }
  }
}
```

Response:
```json
{
  "allowed": true,
  "reason": "Allowed by policy: Allow User Read Access",
  "appliedPolicies": ["Allow User Read Access"]
}
```

### Policy Management

**POST** `/api/v1/policy` - Create a new policy
**GET** `/api/v1/policy` - List all policies
**GET** `/api/v1/policy/:id` - Get policy by ID
**PATCH** `/api/v1/policy/:id` - Update a policy
**DELETE** `/api/v1/policy/:id` - Delete a policy

### Audit Logs

**GET** `/api/v1/policy/audit/logs` - Retrieve audit logs

Query parameters:
- `userId`: Filter by user ID
- `action`: Filter by action
- `limit`: Number of results (default: 100)

### Roles

**GET** `/api/v1/policy/roles/list` - Get all roles

## Policy Definition Structure

### JSON Format

```json
{
  "name": "Allow Admin Full Access",
  "description": "Administrators have full access to all API endpoints",
  "type": "api_access",
  "effect": "allow",
  "priority": 100,
  "conditions": {
    "role": "admin"
  },
  "actions": ["*"],
  "resources": ["/api/*"],
  "isActive": true
}
```

### YAML Format

```yaml
name: "Allow Admin Full Access"
description: "Administrators have full access to all API endpoints"
type: "api_access"
effect: "allow"
priority: 100
conditions:
  role: "admin"
actions:
  - "*"
resources:
  - "/api/*"
isActive: true
```

## Policy Types

1. **api_access**: Control access to API endpoints
2. **self_healing**: Trigger self-healing actions based on system conditions
3. **data_access**: Control access to sensitive data
4. **resource_limit**: Enforce resource usage limits

## Policy Effects

- **allow**: Grant access/permission
- **deny**: Deny access/permission (takes precedence over allow)

## Condition Matching

Policies support various condition types:

### Role-Based
```json
{
  "conditions": {
    "role": "admin"
  }
}
```

### Multiple Roles
```json
{
  "conditions": {
    "roles": ["admin", "auditor"]
  }
}
```

### User-Specific
```json
{
  "conditions": {
    "userId": "user-123"
  }
}
```

### Metadata Matching
```json
{
  "conditions": {
    "metadata": {
      "department": "engineering",
      "level": "senior"
    }
  }
}
```

### Time Range
```json
{
  "conditions": {
    "timeRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  }
}
```

## Wildcard Support

Actions and resources support wildcards:

- `*`: Match any string
- `?`: Match single character

Examples:
- `/api/*`: Matches all API endpoints
- `read*`: Matches read, readAll, readOne
- `/api/users/?`: Matches /api/users/1, /api/users/a

## Priority and Evaluation Order

1. Policies are fetched based on type, action, and resource
2. Policies are sorted by priority (highest first)
3. Conditions are evaluated in order
4. First matching DENY policy stops evaluation and denies access
5. First matching ALLOW policy allows access
6. If no policies match, access is denied by default

## Example Use Cases

### 1. API Access Control

```typescript
// Evaluate API access
const decision = await policyService.evaluate({
  action: 'delete',
  resource: '/api/users/123',
  type: PolicyType.API_ACCESS,
  context: {
    userId: 'user-456',
    role: 'user',
  },
});

if (!decision.allowed) {
  throw new ForbiddenException(decision.reason);
}
```

### 2. Self-Healing Trigger

```typescript
// Check if self-healing action is allowed
const decision = await policyService.evaluate({
  action: 'restart',
  resource: 'service:api',
  type: PolicyType.SELF_HEALING,
  context: {
    metadata: {
      healthStatus: 'unhealthy',
      failureCount: 5,
    },
  },
});

if (decision.allowed) {
  await restartService('api');
}
```

### 3. Data Access Validation

```typescript
// Validate PII access
const decision = await policyService.evaluate({
  action: 'export',
  resource: 'data:pii:emails',
  type: PolicyType.DATA_ACCESS,
  context: {
    userId: 'user-789',
    role: 'auditor',
  },
});
```

## Integration Examples

### AI Engine Integration

```typescript
// AI Engine requests permission before executing action
const policyDecision = await axios.post('http://api/v1/policy/evaluate', {
  action: 'execute_model',
  resource: 'model:gpt4',
  type: 'api_access',
  context: {
    userId: 'ai-service',
    role: 'service',
    metadata: {
      modelSize: 'large',
      cost: 'high',
    },
  },
});

if (policyDecision.data.allowed) {
  // Execute AI model
}
```

### API Pod Integration

```typescript
// API Pod validates request through policy engine
@UseGuards(PolicyGuard)
@RequirePolicy({
  action: 'read',
  resource: '/api/sensitive-data',
  type: PolicyType.DATA_ACCESS,
})
@Get('/sensitive-data')
async getSensitiveData() {
  // Handler code
}
```

## Caching

Policy decisions are cached in Redis for 5 minutes by default. Cache keys include:
- Policy type
- Action
- Resource
- User ID
- Role

This reduces database queries and improves performance for frequently evaluated policies.

## Audit Logging

All policy evaluations are logged with:
- User ID
- Action and resource
- Result (allow/deny/error)
- Applied policies
- Context data
- IP address and user agent
- Timestamp

Audit logs are immutable (insert-only) and indexed for efficient querying.

## Security Considerations

1. **Default Deny**: If no policy matches, access is denied
2. **Deny Precedence**: DENY policies take precedence over ALLOW
3. **Immutable Logs**: Audit logs cannot be modified or deleted
4. **Input Validation**: All inputs are validated using DTOs
5. **Rate Limiting**: Policy evaluation endpoint has rate limits
6. **Service Authentication**: Consider using API keys for service-to-service calls

## Testing

Run unit tests:
```bash
npm run test -- policy.service.spec
```

Example test cases:
- Allow access with matching ALLOW policy
- Deny access with matching DENY policy
- Deny takes precedence over allow
- No matching policy defaults to deny
- Cache hits return cached decisions
- Wildcard matching works correctly

## Performance

- **Cache Hit**: ~1ms (Redis lookup)
- **Cache Miss**: ~10-50ms (database query + evaluation)
- **Concurrent Evaluations**: Supports high concurrency
- **Database**: Indexed queries on userId, action, type

## Example Policy Definitions

See `src/policy/examples/` for comprehensive policy examples:
- `policy-definitions.json`: JSON format
- `policy-definitions.yaml`: YAML format

These examples cover:
- API access policies
- Self-healing policies
- Data access policies
- Resource limit policies
- Emergency policies

## Future Enhancements

- [ ] Policy versioning
- [ ] Policy testing sandbox
- [ ] Policy impact analysis
- [ ] Machine learning for policy recommendations
- [ ] Policy conflict detection
- [ ] Bulk policy evaluation
- [ ] Policy templates
- [ ] GraphQL support
