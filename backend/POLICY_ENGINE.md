# Aegis Policy Engine

A production-ready policy evaluation engine for enforcing API access control, RBAC, and self-healing triggers with immutable audit logging.

## Quick Start

### 1. Database Setup

The Policy Engine uses PostgreSQL to store policies, roles, and audit logs. Tables are automatically created on first run (development mode).

### 2. Seed Initial Data

```bash
# Load environment variables
cd backend
source .env  # or use `set -a; source .env; set +a` in bash

# Run seed script
npx ts-node src/policy/scripts/seed-policies.ts
```

This creates:
- 3 roles: admin, user, auditor
- 6 default policies for API access and self-healing

### 3. Test the Policy Engine

```bash
# Start the API
npm run start:dev

# Test policy evaluation
curl -X POST http://localhost:3000/api/v1/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "action": "read",
    "resource": "/api/users/me",
    "type": "api_access",
    "context": {
      "userId": "user-123",
      "role": "user"
    }
  }'
```

Expected response:
```json
{
  "allowed": true,
  "reason": "Allowed by policy: Allow User Read Access",
  "appliedPolicies": ["Allow User Read Access"]
}
```

## API Endpoints

### Policy Evaluation

```bash
POST /api/v1/policy/evaluate
```

**Request:**
```json
{
  "action": "delete",
  "resource": "/api/users/456",
  "type": "api_access",
  "context": {
    "userId": "user-123",
    "role": "user",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0"
  }
}
```

**Response:**
```json
{
  "allowed": false,
  "reason": "Denied by policy: Deny User Delete Operations",
  "appliedPolicies": ["Deny User Delete Operations"]
}
```

### Policy Management

```bash
# Create policy
POST /api/v1/policy
Authorization: Bearer <jwt_token>

# List policies
GET /api/v1/policy
Authorization: Bearer <jwt_token>

# Get policy
GET /api/v1/policy/:id
Authorization: Bearer <jwt_token>

# Update policy
PATCH /api/v1/policy/:id
Authorization: Bearer <jwt_token>

# Delete policy
DELETE /api/v1/policy/:id
Authorization: Bearer <jwt_token>
```

### Audit Logs

```bash
# Get audit logs
GET /api/v1/policy/audit/logs?userId=user-123&limit=50
Authorization: Bearer <jwt_token>
```

### Roles

```bash
# List roles
GET /api/v1/policy/roles/list
Authorization: Bearer <jwt_token>
```

## Policy Types

1. **api_access**: Control API endpoint access
2. **self_healing**: Trigger automated system recovery
3. **data_access**: Control sensitive data access
4. **resource_limit**: Enforce resource usage limits

## RBAC Roles

### Admin
- Full access to all endpoints
- Can create/modify/delete policies
- Can view all audit logs

### User
- Read access to own data
- Cannot delete resources
- Limited API access

### Auditor
- Read-only access to logs
- Can view audit trails
- Cannot modify system data

## Example Policies

### 1. Allow Admin Full Access

```json
{
  "name": "Allow Admin Full Access",
  "type": "api_access",
  "effect": "allow",
  "priority": 100,
  "conditions": { "role": "admin" },
  "actions": ["*"],
  "resources": ["/api/*"],
  "isActive": true
}
```

### 2. Self-Healing: Auto Restart

```json
{
  "name": "Auto Restart Failed Services",
  "type": "self_healing",
  "effect": "allow",
  "priority": 100,
  "conditions": {
    "metadata": {
      "healthStatus": "unhealthy",
      "failureCount": 3
    }
  },
  "actions": ["restart", "notify"],
  "resources": ["service:*"],
  "isActive": true
}
```

### 3. Data Access Control

```json
{
  "name": "Restrict PII Access",
  "type": "data_access",
  "effect": "allow",
  "priority": 150,
  "conditions": {
    "roles": ["admin", "auditor"]
  },
  "actions": ["read", "export"],
  "resources": ["data:pii:*"],
  "isActive": true
}
```

## Integration Examples

### Integration with AI Engine

```typescript
// AI Engine checks policy before executing
const response = await fetch('http://api:3000/api/v1/policy/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'execute_model',
    resource: 'model:gpt4',
    type: 'api_access',
    context: {
      userId: 'ai-service',
      role: 'service',
      metadata: { modelSize: 'large' }
    }
  })
});

const decision = await response.json();

if (decision.allowed) {
  // Execute AI model
} else {
  console.log(`Denied: ${decision.reason}`);
}
```

### Integration with API Pods

```typescript
// Middleware to enforce policies
@Injectable()
export class PolicyEnforcementGuard implements CanActivate {
  constructor(private policyService: PolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const decision = await this.policyService.evaluate({
      action: request.method.toLowerCase(),
      resource: request.path,
      type: PolicyType.API_ACCESS,
      context: {
        userId: user.id,
        role: user.roles[0]?.name || 'user',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    });

    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason);
    }

    return true;
  }
}
```

## Performance

- **Cache Hit**: ~1ms (Redis)
- **Cache Miss**: ~10-50ms (PostgreSQL + evaluation)
- **Cache TTL**: 5 minutes (configurable)
- **Concurrent Requests**: High concurrency support

## Security Features

✅ **Default Deny**: No matching policy = access denied  
✅ **Deny Precedence**: DENY policies override ALLOW  
✅ **Immutable Audit Logs**: Append-only, cannot be modified  
✅ **Input Validation**: All inputs validated with class-validator  
✅ **Rate Limiting**: Configurable per-endpoint rate limits  
✅ **Encrypted Storage**: Sensitive data encrypted at rest  

## Monitoring

### Audit Log Queries

```sql
-- Recent denials
SELECT * FROM policy_audit_logs 
WHERE result = 'deny' 
ORDER BY "createdAt" DESC 
LIMIT 50;

-- User activity
SELECT action, resource, result, COUNT(*) 
FROM policy_audit_logs 
WHERE "userId" = 'user-123' 
GROUP BY action, resource, result;

-- Failed evaluations
SELECT * FROM policy_audit_logs 
WHERE result = 'error' 
ORDER BY "createdAt" DESC;
```

### Metrics to Track

- Policy evaluation latency
- Cache hit rate
- Denial rate by user/role
- Error rate
- Audit log growth

## Troubleshooting

### Policy Not Matching

1. Check policy is active: `isActive = true`
2. Verify action/resource wildcards
3. Check condition matching logic
4. Review policy priority order

### High Latency

1. Check Redis connection
2. Review database indexes
3. Analyze policy count
4. Consider caching strategies

### Audit Logs Growing Too Fast

1. Archive old logs periodically
2. Add data retention policies
3. Consider log aggregation
4. Use time-based partitioning

## Testing

```bash
# Unit tests
npm run test -- policy.service.spec

# Test policy evaluation
npm run test -- --grep "evaluate"

# Test with coverage
npm run test:cov
```

## Production Checklist

- [ ] Change default passwords
- [ ] Configure proper JWT secrets
- [ ] Enable SSL/TLS for database
- [ ] Set up Redis password
- [ ] Configure rate limits appropriately
- [ ] Set up log rotation
- [ ] Enable monitoring and alerting
- [ ] Review and customize default policies
- [ ] Set up backup for audit logs
- [ ] Configure firewall rules

## Documentation

- Full API docs: [src/policy/README.md](src/policy/README.md)
- Example policies: [src/policy/examples/](src/policy/examples/)
- Integration guides: See README sections above

## Support

For issues or questions about the Policy Engine:
1. Check the logs for error messages
2. Review audit logs for evaluation history
3. Verify policy definitions and conditions
4. Check database connectivity and health
