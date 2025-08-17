# Task Management Web Application

A modern, responsive web application built with React, Next.js, and TypeScript for comprehensive task and project management.

## Features

- 🚀 **Modern Stack**: Built with Next.js 14, React 18, and TypeScript
- 🎨 **Beautiful UI**: Tailwind CSS with dark mode support
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- 🔐 **Authentication**: Secure JWT-based authentication with 2FA support
- 🔄 **Real-time Updates**: WebSocket integration for live collaboration
- 📊 **State Management**: Redux Toolkit with persistence
- 🧪 **Testing**: Comprehensive test suite with Vitest and Testing Library
- ♿ **Accessibility**: WCAG 2.1 AA compliant
- 🌐 **Internationalization**: Multi-language support
- 📈 **Performance**: Optimized for Core Web Vitals

## Tech Stack

### Core
- **Framework**: Next.js 14
- **Language**: TypeScript
- **UI Library**: React 18
- **Styling**: Tailwind CSS

### State Management
- **Global State**: Redux Toolkit
- **Server State**: TanStack Query (React Query)
- **Persistence**: Redux Persist

### API & Real-time
- **API Client**: tRPC
- **WebSocket**: Native WebSocket API
- **HTTP Client**: Fetch API with interceptors

### Development
- **Build Tool**: Next.js built-in bundler
- **Testing**: Vitest + Testing Library
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+ or pnpm 8+

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   NEXT_PUBLIC_APP_NAME="Task Management"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   NEXT_PUBLIC_API_URL="http://localhost:3001"
   NEXT_PUBLIC_WS_URL="ws://localhost:3001"
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Open your browser** and navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

### Testing
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:ui` - Run tests with UI

### Storybook
- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for production

### Analysis
- `npm run analyze` - Analyze bundle size
- `npm run clean` - Clean build artifacts

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI components
│   ├── forms/          # Form components
│   ├── layout/         # Layout components
│   ├── pages/          # Page-specific components
│   └── providers/      # Context providers
├── pages/              # Next.js pages
├── hooks/              # Custom React hooks
├── services/           # API services
├── store/              # Redux store and slices
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── config/             # Configuration files
├── styles/             # Global styles
├── assets/             # Static assets
└── tests/              # Test utilities and setup
```

## Key Features

### Authentication
- JWT-based authentication
- Refresh token rotation
- Multi-factor authentication (2FA)
- Biometric authentication support
- Session management

### Task Management
- Create, edit, and delete tasks
- Task assignment and status tracking
- Due dates and priorities
- File attachments
- Comments and activity history

### Project Management
- Project creation and organization
- Team member management
- Project templates
- Progress tracking
- Gantt charts and timelines

### Real-time Collaboration
- Live task updates
- User presence indicators
- Real-time notifications
- Collaborative editing
- Activity feeds

### Responsive Design
- Mobile-first approach
- Touch-friendly interactions
- Adaptive layouts
- Progressive Web App (PWA) features

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_NAME` | Application name | "Task Management" |
| `NEXT_PUBLIC_APP_URL` | Application URL | "http://localhost:3000" |
| `NEXT_PUBLIC_API_URL` | API server URL | "http://localhost:3001" |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | "ws://localhost:3001" |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error reporting | - |
| `NEXT_PUBLIC_ANALYTICS_ID` | Analytics tracking ID | - |

### Theme Configuration

The application supports light, dark, and system themes. Theme preferences are persisted in localStorage.

### Internationalization

Currently supports:
- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Chinese (zh)

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage Report
```bash
npm run test:coverage
```

## Performance

### Bundle Analysis
```bash
npm run analyze
```

### Core Web Vitals
The application is optimized for:
- **LCP** (Largest Contentful Paint) < 2.5s
- **FID** (First Input Delay) < 100ms
- **CLS** (Cumulative Layout Shift) < 0.1

### Optimization Features
- Code splitting and lazy loading
- Image optimization
- Service worker caching
- Bundle size monitoring
- Performance budgets

## Accessibility

The application follows WCAG 2.1 AA guidelines:
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode
- Focus management
- ARIA labels and roles

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the development team

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history and updates.