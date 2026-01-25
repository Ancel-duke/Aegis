# Aegis Frontend

Modern React (Next.js 15) frontend for the Aegis self-healing platform.

## Features

- **Authentication**: JWT-based login/signup with secure httpOnly cookies
- **Dashboard**: System health metrics, alerts, AI insights overview
- **Alerts Panel**: Real-time alerts with WebSocket updates, severity filtering
- **AI Insights**: Anomaly detection visualization, trends, heatmaps
- **Policy Management**: CRUD operations for access and self-healing policies
- **System Health**: Real-time metrics, service status, pod monitoring
- **Logs Viewer**: Real-time log streaming with filtering and search
- **User Profile**: Profile management and password change
- **Role-Based Access**: Different views for admin, auditor, and user roles

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **Testing**: Jest + React Testing Library

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your settings
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3001
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/               # Auth pages (login, signup)
│   ├── (dashboard)/        # Dashboard layout group
│   │   ├── dashboard/      # Main dashboard
│   │   ├── alerts/         # Alerts page
│   │   ├── ai-insights/    # AI insights page
│   │   ├── policies/       # Policy management
│   │   ├── health/         # System health
│   │   ├── logs/           # Logs viewer
│   │   └── profile/        # User profile
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
│
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   └── toaster.tsx
│   ├── charts/             # Chart components
│   │   ├── line-chart.tsx
│   │   ├── area-chart.tsx
│   │   ├── bar-chart.tsx
│   │   └── donut-chart.tsx
│   ├── dashboard/          # Dashboard-specific components
│   │   └── stat-card.tsx
│   ├── layout/             # Layout components
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   └── providers.tsx       # Context providers
│
├── stores/                 # Zustand stores
│   ├── auth-store.ts       # Authentication state
│   ├── alerts-store.ts     # Alerts state
│   ├── metrics-store.ts    # Metrics state
│   ├── ai-store.ts         # AI insights state
│   ├── policies-store.ts   # Policies state
│   └── logs-store.ts       # Logs state
│
├── lib/
│   ├── api/
│   │   └── client.ts       # Axios API client
│   ├── utils.ts            # Utility functions
│   └── websocket.ts        # WebSocket hook
│
├── types/
│   └── index.ts            # TypeScript types
│
└── __tests__/              # Unit tests
    ├── components/
    ├── stores/
    └── lib/
```

## Pages

### Authentication (`/auth/*`)

- **Login** (`/auth/login`): JWT login with validation
- **Signup** (`/auth/signup`): User registration with password requirements

### Dashboard (`/dashboard`)

Main overview with:
- System resource stats (CPU, memory, disk)
- Active alerts count
- Recent healing actions
- Resource usage charts
- Pod status distribution
- Recent alerts list
- AI insights preview

### Alerts (`/alerts`)

- Real-time WebSocket updates
- Severity filtering (critical, high, medium, low, info)
- Search and filtering
- Resolve/unresolve actions
- Expandable alert details

### AI Insights (`/ai-insights`)

- Anomaly detection results
- Trend charts
- Severity distribution
- Healing actions history
- AI recommendations

### Policies (`/policies`)

- List all policies
- Create/edit/delete (admin only)
- JSON rule editor
- Enable/disable toggle
- Type filtering

### System Health (`/health`)

- Real-time service status
- Resource usage charts
- Network traffic
- Pod status
- Request/error rates

### Logs (`/logs`)

- Real-time log streaming
- Level filtering (debug, info, warn, error, fatal)
- Service filtering
- Search functionality
- Log export

### Profile (`/profile`)

- View account info
- Edit username/email
- Change password
- View role and permissions

## State Management

Using Zustand for global state with the following stores:

- **authStore**: User authentication, login/logout, role checking
- **alertsStore**: Alerts CRUD, filtering, WebSocket updates
- **metricsStore**: System metrics, historical data
- **aiStore**: AI predictions, insights, healing actions
- **policiesStore**: Policy CRUD, filtering
- **logsStore**: Log entries, streaming, filtering

## API Integration

The frontend expects the backend API at `/api/v1/*` with the following endpoints:

```
POST   /auth/login
POST   /auth/signup
POST   /auth/logout
POST   /auth/refresh
GET    /auth/me

GET    /alerts
GET    /alerts/:id
PATCH  /alerts/:id/resolve
PATCH  /alerts/:id/unresolve

GET    /policies
GET    /policies/:id
POST   /policies
PATCH  /policies/:id
DELETE /policies/:id

GET    /metrics/current
GET    /metrics/historical

GET    /ai/predictions
GET    /ai/insights
GET    /ai/trends
GET    /ai/heatmap

GET    /executor/actions

GET    /logs
GET    /logs/:id
GET    /logs/services

PATCH  /users/me
PATCH  /users/me/password
```

## WebSocket Events

The frontend listens for these WebSocket events:

- `alert:created` - New alert
- `alert:updated` - Alert updated
- `alert:resolved` - Alert resolved
- `metrics:update` - Metrics refresh
- `log:entry` - New log entry
- `ai:anomaly_detected` - Anomaly detected
- `executor:action_started` - Action started
- `executor:action_completed` - Action completed

## Security

- JWT tokens stored in httpOnly cookies
- CSRF protection
- XSS prevention (input sanitization)
- Role-based access control
- Secure headers via Next.js config

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXT_PUBLIC_JWT_COOKIE_NAME=aegis_token
NEXT_PUBLIC_REFRESH_COOKIE_NAME=aegis_refresh
NEXT_PUBLIC_ENABLE_WEBSOCKET=true
```

## License

MIT
