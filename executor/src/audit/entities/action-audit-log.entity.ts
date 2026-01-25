import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ActionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum ActionType {
  RESTART_POD = 'restart_pod',
  SCALE_DEPLOYMENT = 'scale_deployment',
  ROLLBACK_DEPLOYMENT = 'rollback_deployment',
  DELETE_POD = 'delete_pod',
  UPDATE_CONFIG = 'update_config',
}

@Entity('action_audit_logs')
@Index(['namespace', 'createdAt'])
@Index(['actionType', 'createdAt'])
@Index(['status', 'createdAt'])
export class ActionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  @Index()
  actionType: ActionType;

  @Column({
    type: 'enum',
    enum: ActionStatus,
  })
  @Index()
  status: ActionStatus;

  @Column()
  namespace: string;

  @Column()
  resourceType: string; // 'pod', 'deployment', 'service'

  @Column()
  resourceName: string;

  @Column({ type: 'jsonb' })
  actionParams: Record<string, any>;

  @Column({ nullable: true })
  requestedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  policyDecision: Record<string, any>;

  @Column({ nullable: true })
  executionDuration: number; // milliseconds

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  signature: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
