# Aegis API

A stateless, production-ready API service built with NestJS, featuring JWT authentication, rate limiting, and comprehensive security features.

## Features

- **Framework**: NestJS with TypeScript
- **Authentication**: JWT-based with access and refresh tokens
- **Rate Limiting**: Per-user, per-endpoint rate limiting using Redis
- **Validation**: Input validation with class-validator
- **Logging**: Request logging middleware (method, path, IP)
- **Health Checks**: Health check endpoints for monitoring
- **Error Handling**: Graceful error handling (4xx user errors, 5xx system errors)
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis for session caching and rate limiting
- **Security**: Password hashing with bcrypt, JWT rotation
- **Containerization**: Docker with multi-stage build and non-root user

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **ORM**: TypeORM
- **Authentication**: Passport JWT
- **Validation**: class-validator, class-transformer
- **Testing**: Jest

## Project Structure

```
backend/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── decorators/          # Custom decorators (Public, GetUser)
│   │   ├── dto/                 # Data Transfer Objects
│   │   ├── guards/              # Auth guards (JWT, Refresh)
│   │   ├── strategies/          # Passport strategies
│   │   ├── auth.controller.ts   # Auth endpoints
│   │   ├── auth.service.ts      # Auth business logic
│   │   └── auth.module.ts       # Auth module definition
│   ├── user/                    # User module
│   │   ├── dto/                 # User DTOs
│   │   ├── entities/            # User entity
│   │   ├── user.controller.ts   # User endpoints
│   │   ├── user.service.ts      # User business logic
│   │   └── user.module.ts       # User module definition
│   ├── core/                    # Core module
│   │   └── health/              # Health check endpoints
│   ├── common/                  # Shared utilities
│   │   ├── config/              # Configuration & validation
│   │   ├── decorators/          # Shared decorators
│   │   ├── filters/             # Exception filters
│   │   ├── guards/              # Shared guards
│   │   ├── interceptors/        # Interceptors (logging)
│   │   └── redis/               # Redis service
│   ├── app.module.ts            # Root module
│   └── main.ts                  # Application entry point
├── test/                        # E2E tests
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Docker Compose configuration
├── .env.example                 # Environment variables template
└── package.json                 # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**

```bash
cd backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=aegis_user
DB_PASSWORD=your_secure_password
DB_DATABASE=aegis_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT - IMPORTANT: Change these in production!
JWT_SECRET=your_jwt_secret_change_this_in_production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=your_refresh_secret_change_this_in_production
JWT_REFRESH_EXPIRATION=7d

# Security
BCRYPT_ROUNDS=10
```

4. **Start PostgreSQL and Redis**

Using Docker Compose (recommended):

```bash
docker-compose up -d postgres redis
```

Or install and run them locally.

5. **Run the application**

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

## Docker Deployment

### Using Docker Compose (Recommended)

This starts the API, PostgreSQL, and Redis:

```bash
docker-compose up -d
```

The API will be available at `http://localhost:3000/api/v1`

### Building Docker Image Manually

```bash
docker build -t aegis-api .
docker run -p 3000:3000 --env-file .env aegis-api
```

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Authentication Endpoints

#### 1. Sign Up

**POST** `/auth/signup`

Rate limit: 5 requests per hour per IP

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 2. Login

**POST** `/auth/login`

Rate limit: 10 requests per 15 minutes per IP

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 3. Refresh Tokens

**POST** `/auth/refresh`

Headers:

```
Authorization: Bearer <refresh_token>
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 4. Logout

**POST** `/auth/logout`

Headers:

```
Authorization: Bearer <access_token>
```

Response:

```json
{
  "message": "Logged out successfully"
}
```

### User Endpoints

All user endpoints require authentication. Add the access token to the Authorization header:

```
Authorization: Bearer <access_token>
```

#### 1. Get Current User Profile

**GET** `/users/me`

Rate limit: 30 requests per minute per user

Response:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### 2. Get All Users

**GET** `/users`

Rate limit: 20 requests per minute per user

#### 3. Get User by ID

**GET** `/users/:id`

#### 4. Update User

**PATCH** `/users/:id`

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": true
}
```

#### 5. Delete User

**DELETE** `/users/:id`

### Health Check Endpoints

#### 1. Full Health Check

**GET** `/health`

Returns health status of the API and database connection.

```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  }
}
```

#### 2. Simple Ping

**GET** `/health/ping`

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67
}
```

## Rate Limiting

Rate limiting is implemented per-user and per-endpoint using Redis:

- **Signup**: 5 requests per hour
- **Login**: 10 requests per 15 minutes
- **User Profile**: 30 requests per minute
- **User List**: 20 requests per minute

When rate limit is exceeded, the API returns:

```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests"
}
```

## Error Handling

The API uses standard HTTP status codes:

### 4xx Client Errors

- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded

### 5xx Server Errors

- **500 Internal Server Error**: Unexpected server error

Error response format:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/auth/login",
  "method": "POST",
  "error": "Bad Request",
  "message": "Validation failed"
}
```

## Security Features

### Password Security

- Passwords are hashed using bcrypt with configurable rounds (default: 10)
- Minimum password length: 8 characters
- Passwords are never returned in API responses

### JWT Security

- **Access tokens**: Short-lived (15 minutes)
- **Refresh tokens**: Long-lived (7 days)
- Refresh tokens are hashed before storage
- Token rotation on refresh
- Separate secrets for access and refresh tokens

### Request Logging

All requests are logged with:

- HTTP method
- URL path
- Status code
- IP address
- User agent
- Processing time

### Input Validation

All input is validated using class-validator:

- Email format validation
- String length constraints
- Required field validation
- Type validation

## Testing

### Run Unit Tests

```bash
npm run test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npm run test -- auth.service.spec.ts
```

## Custom Decorators

### @Public()

Mark endpoints as public (no authentication required):

```typescript
@Get('public-data')
@Public()
getData() {
  return { data: 'Public data' };
}
```

### @GetUser()

Extract user from request:

```typescript
@Get('profile')
getProfile(@GetUser() user: User) {
  return user;
}

// Get specific user property
@Get('email')
getEmail(@GetUser('email') email: string) {
  return { email };
}
```

### @RateLimit()

Apply custom rate limits:

```typescript
@Get('expensive-operation')
@UseGuards(RateLimitGuard)
@RateLimit({ ttl: 3600, limit: 5 }) // 5 requests per hour
expensiveOperation() {
  // ...
}
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `API_PREFIX` | API route prefix | `api/v1` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `DB_DATABASE` | Database name | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `JWT_SECRET` | Access token secret | - |
| `JWT_ACCESS_EXPIRATION` | Access token expiration | `15m` |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration | `7d` |
| `BCRYPT_ROUNDS` | Bcrypt hashing rounds | `10` |

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running
2. Verify database credentials in `.env`
3. Check database exists: `psql -U aegis_user -d aegis_db`

### Redis Connection Issues

1. Ensure Redis is running
2. Test connection: `redis-cli ping`
3. The API will work without Redis but rate limiting will be disabled

### Docker Issues

1. Ensure Docker and Docker Compose are installed
2. Check container logs: `docker-compose logs api`
3. Restart containers: `docker-compose restart`

## Production Considerations

1. **Environment Variables**: Use strong, unique secrets for JWT tokens
2. **Database**: Use connection pooling and enable SSL
3. **Redis**: Enable password authentication
4. **HTTPS**: Use a reverse proxy (nginx, Caddy) with SSL certificates
5. **Monitoring**: Set up application monitoring and logging
6. **Backups**: Regular database backups
7. **Rate Limiting**: Adjust rate limits based on your needs

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
