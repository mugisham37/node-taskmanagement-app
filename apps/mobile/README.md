# Task Management Mobile App

A React Native mobile application for task management built with Expo.

## Features

- 📱 Cross-platform (iOS & Android)
- 🔐 Biometric authentication
- 📴 Offline-first architecture
- 🔄 Real-time synchronization
- 📸 Camera integration
- 🔔 Push notifications
- 🎨 Modern UI with React Native Paper
- 🏗️ TypeScript for type safety
- 🧪 Comprehensive testing setup

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation v6
- **UI Library**: React Native Paper
- **Forms**: React Hook Form with Zod validation
- **Storage**: AsyncStorage + Expo SecureStore
- **Testing**: Jest + React Native Testing Library
- **Linting**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on specific platform:
```bash
# iOS
npm run ios

# Android
npm run android

# Web (for testing)
npm run web
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
├── navigation/         # Navigation configuration
├── services/          # API and external services
├── store/             # Redux store and slices
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
├── config/            # App configuration
├── styles/            # Styling and theming
├── assets/            # Images, fonts, etc.
└── tests/             # Test utilities and setup
```

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run build:android` - Build for Android
- `npm run build:ios` - Build for iOS

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
API_URL=http://localhost:3000
WEBSOCKET_URL=ws://localhost:3000
ENVIRONMENT=development
```

### EAS Build

Configure EAS build in `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

## Features Implementation

### Authentication
- JWT token-based authentication
- Biometric authentication (Touch ID, Face ID)
- Secure token storage with Expo SecureStore
- Auto-refresh token mechanism

### Offline Support
- Local data caching with AsyncStorage
- Offline queue for API requests
- Automatic sync when connection restored
- Conflict resolution strategies

### Push Notifications
- Expo Notifications integration
- Local and remote notifications
- Deep linking support
- Notification scheduling

### Camera Integration
- Image capture and selection
- File upload functionality
- Image optimization
- Permission handling

## Testing

The app includes comprehensive testing setup:

- Unit tests with Jest
- Component tests with React Native Testing Library
- Integration tests for Redux store
- E2E tests with Detox (planned)

Run tests:
```bash
npm test
```

## Deployment

### Development Build
```bash
eas build --profile development
```

### Production Build
```bash
eas build --profile production
```

### App Store Submission
```bash
eas submit --platform ios
eas submit --platform android
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

## License

This project is licensed under the MIT License.