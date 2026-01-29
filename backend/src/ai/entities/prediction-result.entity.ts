import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('prediction_results')
@Index(['predictionType', 'createdAt'])
@Index(['createdAt'])
export class PredictionResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prediction_type' })
  @Index()
  predictionType: string;

  @Column({ name: 'request_payload', type: 'jsonb', default: {} })
  requestPayload: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', default: {} })
  responsePayload: Record<string, unknown>;

  @Column({ type: 'float', nullable: true })
  score: number;

  @Column({ nullable: true })
  severity: string;

  @Column({ default: true })
  success: boolean;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;
}
