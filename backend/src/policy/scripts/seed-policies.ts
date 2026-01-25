import { DataSource } from 'typeorm';
import { Policy, PolicyType, PolicyEffect } from '../entities/policy.entity';
import { Role, RoleType } from '../entities/role.entity';

/**
 * Seed script to populate initial policies and roles
 * Run with: npx ts-node src/policy/scripts/seed-policies.ts
 */

const policies = [
  {
    name: 'Allow Admin Full Access',
    description: 'Administrators have full access to all API endpoints',
    type: PolicyType.API_ACCESS,
    effect: PolicyEffect.ALLOW,
    priority: 100,
    conditions: { role: 'admin' },
    actions: ['*'],
    resources: ['/api/*'],
    isActive: true,
  },
  {
    name: 'Allow User Read Access',
    description: 'Regular users can read their own data',
    type: PolicyType.API_ACCESS,
    effect: PolicyEffect.ALLOW,
    priority: 50,
    conditions: { role: 'user' },
    actions: ['read', 'list'],
    resources: ['/api/users/me', '/api/profile'],
    isActive: true,
  },
  {
    name: 'Deny User Delete Operations',
    description: 'Regular users cannot delete any resources',
    type: PolicyType.API_ACCESS,
    effect: PolicyEffect.DENY,
    priority: 200,
    conditions: { role: 'user' },
    actions: ['delete'],
    resources: ['/api/*'],
    isActive: true,
  },
  {
    name: 'Allow Auditor Read-Only Access',
    description: 'Auditors have read-only access to logs and audit trails',
    type: PolicyType.API_ACCESS,
    effect: PolicyEffect.ALLOW,
    priority: 75,
    conditions: { role: 'auditor' },
    actions: ['read', 'list'],
    resources: ['/api/audit/*', '/api/logs/*', '/api/policy/audit/logs'],
    isActive: true,
  },
  {
    name: 'Auto Restart Failed Services',
    description: 'Automatically restart services that have failed health checks',
    type: PolicyType.SELF_HEALING,
    effect: PolicyEffect.ALLOW,
    priority: 100,
    conditions: {
      metadata: {
        healthStatus: 'unhealthy',
        failureCount: 3,
      },
    },
    actions: ['restart', 'notify'],
    resources: ['service:*'],
    isActive: true,
  },
  {
    name: 'Scale Up on High Load',
    description: 'Scale up services when CPU usage exceeds threshold',
    type: PolicyType.SELF_HEALING,
    effect: PolicyEffect.ALLOW,
    priority: 90,
    conditions: {
      metadata: {
        cpuUsage: 80,
        duration: 300,
      },
    },
    actions: ['scale_up', 'alert'],
    resources: ['service:api', 'service:worker'],
    isActive: true,
  },
];

const roles = [
  {
    name: RoleType.ADMIN,
    description: 'Administrator with full system access',
    permissions: {
      api: ['*'],
      data: ['*'],
      system: ['*'],
    },
  },
  {
    name: RoleType.USER,
    description: 'Regular user with limited access',
    permissions: {
      api: ['read', 'update'],
      data: ['read'],
    },
  },
  {
    name: RoleType.AUDITOR,
    description: 'Auditor with read-only access to logs and audit trails',
    permissions: {
      api: ['read'],
      logs: ['read', 'export'],
      audit: ['read', 'export'],
    },
  },
];

async function seed() {
  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'aegis_user',
    password: process.env.DB_PASSWORD || 'aegis_password',
    database: process.env.DB_DATABASE || 'aegis_db',
    entities: [Policy, Role],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database connected');

  try {
    // Seed roles
    console.log('\nSeeding roles...');
    const roleRepository = dataSource.getRepository(Role);
    
    for (const roleData of roles) {
      const existing = await roleRepository.findOne({
        where: { name: roleData.name },
      });

      if (!existing) {
        const role = roleRepository.create(roleData);
        await roleRepository.save(role);
        console.log(`✓ Created role: ${roleData.name}`);
      } else {
        console.log(`- Role already exists: ${roleData.name}`);
      }
    }

    // Seed policies
    console.log('\nSeeding policies...');
    const policyRepository = dataSource.getRepository(Policy);

    for (const policyData of policies) {
      const existing = await policyRepository.findOne({
        where: { name: policyData.name },
      });

      if (!existing) {
        const policy = policyRepository.create(policyData);
        await policyRepository.save(policy);
        console.log(`✓ Created policy: ${policyData.name}`);
      } else {
        console.log(`- Policy already exists: ${policyData.name}`);
      }
    }

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seed();
