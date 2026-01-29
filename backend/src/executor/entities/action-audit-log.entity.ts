import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('action_audit_logs')
@Index(['namespace', 'createdAt'])
@Index(['status', 'createdAt'])
export class ActionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'action_type' })
  @Index()
  actionType: string;

  @Column({ default: 'pending' })
  @Index()
  status: string;

  @Column()
  @Index()
  namespace: string;

  @Column({ name: 'resource_type' })
  resourceType: string;

  @Column({ name: 'resource_name' })
  resourceName: string;

  @Column({ name: 'action_params', type: 'jsonb', default: {} })
  actionParams: Record<string, unknown>;

  @Column({ name: 'requested_by', nullable: true })
  requestedBy: string;

  @Column({ name: 'execution_duration', nullable: true })
  executionDuration: number;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'signature_provided', nullable: true })
  signatureProvided: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;
}
