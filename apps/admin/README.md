# TaskManagement Admin Dashboard

A comprehensive admin dashboard for the TaskManagement system built with Next.js 14, React 18, TypeScript, and Tailwind CSS.

## Features

### 🔐 Authentication & Security
- **Multi-factor Authentication (MFA)** - TOTP and backup codes support
- **Role-based Access Control (RBAC)** - Fine-grained permissions system
- **Session Management** - Automatic timeout and activity tracking
- **Admin-level Security** - Enhanced security measures for admin access

### 👥 User Management
- **Complete User CRUD** - Create, read, update, delete users
- **Bulk Operations** - Mass user operations (activate, deactivate, role assignment)
- **User Activity Tracking** - Monitor user actions and sessions
- **Role & Permission Management** - Assign and manage user roles
- **Import/Export** - CSV and Excel support for user data

### 📊 System Monitoring
- **Real-time Metrics** - CPU, memory, disk, and network monitoring
- **Service Health Checks** - Monitor application and dependency health
- **Performance Analytics** - API response times, throughput, error rates
- **Log Management** - Centralized log viewing and filtering

### 📈 Analytics Dashboard
- **User Engagement Metrics** - DAU, WAU, MAU, retention rates
- **Feature Usage Analytics** - Track feature adoption and usage patterns
- **Business Metrics** - Revenue, conversions, customer metrics
- **Custom Reports** - Create and schedule custom analytics reports

### 🚨 Alert Management
- **Real-time Alerts** - System, security, and business alerts
- **Alert Rules** - Configure custom alerting rules and thresholds
- **Notification Channels** - Email, Slack, webhook, SMS, PagerDuty
- **Escalation Policies** - Multi-level alert escalation

### ⚙️ System Settings
- **General Configuration** - Site settings, timezone, language
- **Security Policies** - Password policies, session timeouts
- **Feature Flags** - Enable/disable features with rollout percentages
- **Integration Settings** - Configure external service integrations
- **Email Templates** - Manage system email templates
- **API Key Management** - Generate and manage API keys

### 📋 Audit & Compliance
- **Audit Logs** - Complete audit trail of all system actions
- **Security Events** - Track security-related events and incidents
- **Compliance Reports** - GDPR, SOC 2, HIPAA compliance reporting
- **Data Retention Policies** - Configure data retention and archival

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library with concurrent features
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Redux Toolkit** - State management with RTK Query
- **React Query** - Server state management
- **React Hook Form** - Form handling with validation
- **Recharts** - Data visualization and charts

### Development Tools
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **Vitest** - Unit testing framework
- **Storybook** - Component development and documentation

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 8+ or pnpm 8+
- Access to TaskManagement API

### Installation

1. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Update the environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_APP_URL=http://localhost:3001
   # ... other configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Open admin dashboard**
   Navigate to [http://localhost:3001](http://localhost:3001)

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
apps/admin/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   │   ├── layout/            # Layout components
│   │   ├── navigation/        # Navigation components
│   │   ├── forms/             # Form components
│   │   ├── tables/            # Table components
│   │   ├── charts/            # Chart components
│   │   ├── monitoring/        # Monitoring components
│   │   ├── users/             # User management components
│   │   ├── analytics/         # Analytics components
│   │   ├── settings/          # Settings components
│   │   ├── alerts/            # Alert components
│   │   └── providers/         # Context providers
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # API services
│   ├── store/                 # Redux store and slices
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript type definitions
│   ├── config/                # Configuration files
│   └── styles/                # Global styles
├── public/                    # Static assets
├── tests/                     # Test files
└── docs/                      # Documentation
```

## Key Components

### Authentication Flow
- Login with email/password
- MFA verification (if enabled)
- Role-based route protection
- Automatic token refresh
- Session timeout handling

### Real-time Updates
- WebSocket connection for live data
- Real-time metrics and alerts
- Live user activity monitoring
- Automatic reconnection handling

### Data Management
- Optimistic updates for better UX
- Comprehensive error handling
- Loading states and skeletons
- Pagination and filtering
- Export/import functionality

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Admin app URL | `http://localhost:3001` |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | `ws://localhost:3000` |
| `NEXT_PUBLIC_AUTH_REQUIRE_MFA` | Require MFA for admin | `true` |
| `NEXT_PUBLIC_PROMETHEUS_URL` | Prometheus endpoint | `http://localhost:9090` |
| `NEXT_PUBLIC_GRAFANA_URL` | Grafana endpoint | `http://localhost:3000` |

### Feature Flags

Enable/disable features using environment variables:

```env
NEXT_PUBLIC_FEATURE_USER_MANAGEMENT=true
NEXT_PUBLIC_FEATURE_SYSTEM_MONITORING=true
NEXT_PUBLIC_FEATURE_ANALYTICS=true
NEXT_PUBLIC_FEATURE_AUDIT_LOGS=true
NEXT_PUBLIC_FEATURE_ALERT_MANAGEMENT=true
```

## Security Considerations

### Admin Access
- Requires admin-level roles
- Enhanced authentication requirements
- Session timeout and activity monitoring
- IP whitelisting support
- Audit logging for all actions

### Data Protection
- Sensitive data masking
- Secure API communication
- CSRF protection
- XSS prevention
- Content Security Policy

## Performance Optimization

### Frontend Optimization
- Code splitting and lazy loading
- Image optimization
- Bundle analysis and optimization
- Service worker for caching
- Performance monitoring

### Real-time Features
- Efficient WebSocket usage
- Selective data updates
- Connection pooling
- Automatic reconnection
- Bandwidth optimization

## Monitoring & Observability

### Application Monitoring
- Performance metrics
- Error tracking and reporting
- User interaction analytics
- Real-time system health
- Custom dashboards

### Integration with Monitoring Stack
- Prometheus metrics collection
- Grafana dashboard embedding
- Jaeger distributed tracing
- ELK stack log aggregation
- Custom alert rules

## Testing

### Unit Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### E2E Tests
```bash
npm run test:e2e
```

### Component Testing
```bash
npm run storybook
```

## Deployment

### Docker Deployment
```bash
docker build -t taskmanagement-admin .
docker run -p 3001:3001 taskmanagement-admin
```

### Production Considerations
- Environment-specific configuration
- SSL/TLS termination
- Load balancing
- Health checks
- Monitoring and alerting
- Backup and recovery

## Contributing

1. Follow the established code style
2. Write comprehensive tests
3. Update documentation
4. Follow security best practices
5. Test admin-specific functionality thoroughly

## License

This project is part of the TaskManagement system and follows the same licensing terms.

## Support

For admin dashboard specific issues:
- Check the troubleshooting guide
- Review system logs
- Contact the development team
- Submit detailed bug reports

---

**Note**: This admin dashboard contains sensitive system management capabilities. Ensure proper access controls and security measures are in place before deployment.