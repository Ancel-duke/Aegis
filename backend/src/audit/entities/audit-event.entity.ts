import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditEventType {
  AUTH_SIGNUP = 'auth_signup',
  AUTH_LOGIN_SUCCESS = 'auth_login_success',
  AUTH_LOGIN_FAILURE = 'auth_login_failure',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_REFRESH = 'auth_refresh',
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  USER_PASSWORD_CHANGE = 'user_password_change',
}

@Entity('audit_events')
@Index(['eventType', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  eventType: AuditEventType;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ nullable: true })
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
