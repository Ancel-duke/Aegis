import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({ cors: { origin: '*' } })
export class AlertsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlertsGateway.name);
  private readonly clients = new Map<string, { userId?: string }>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: any) {
    const token = client.handshake?.auth?.token ?? client.handshake?.query?.token;
    if (token) {
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        this.clients.set(client.id, { userId: payload.sub });
      } catch {
        this.clients.set(client.id, {});
      }
    } else {
      this.clients.set(client.id, {});
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastAlert(alert: Record<string, unknown>): void {
    this.server.emit('alert', { event: 'alert', data: alert });
  }

  broadcastAnomaly(event: Record<string, unknown>): void {
    this.server.emit('anomaly', { event: 'anomaly', data: event });
  }

  getActiveClientsCount(): number {
    return this.clients.size;
  }
}
