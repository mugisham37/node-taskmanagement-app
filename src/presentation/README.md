# Presentation Layer

This layer contains all the external interfaces of the application:

## Structure

- **controllers/**: API controllers that handle HTTP requests
- **routes/**: Route definitions and middleware setup
- **dtos/**: Data Transfer Objects for request/response
- **middleware/**: HTTP middleware components
- **websocket/**: WebSocket gateways and handlers

## Dependencies

The presentation layer can only depend on:

- Application layer (use cases and services)
- Shared layer (types, utilities, etc.)

It should NOT depend on:

- Domain layer (directly)
- Infrastructure layer (directly)
