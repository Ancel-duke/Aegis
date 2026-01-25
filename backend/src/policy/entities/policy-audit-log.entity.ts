import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum EvaluationResult {
  ALLOW = 'allow',
  DENY = 'deny',
  ERROR = 'error',
}

@Entity('policy_audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class PolicyAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({
    type: 'enum',
    enum: EvaluationResult,
  })
  result: EvaluationResult;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  appliedPolicies: string[];

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
