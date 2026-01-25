import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PolicyType {
  API_ACCESS = 'api_access',
  SELF_HEALING = 'self_healing',
  DATA_ACCESS = 'data_access',
  RESOURCE_LIMIT = 'resource_limit',
}

export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PolicyType,
  })
  @Index()
  type: PolicyType;

  @Column({
    type: 'enum',
    enum: PolicyEffect,
    default: PolicyEffect.DENY,
  })
  effect: PolicyEffect;

  @Column({ type: 'jsonb' })
  conditions: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  actions: string[];

  @Column({ type: 'jsonb', default: {} })
  resources: string[];

  @Column({ default: 100 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
