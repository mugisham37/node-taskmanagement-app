# Application Package

This package contains the application layer with use cases, commands, queries, handlers, and application services. It orchestrates domain logic and coordinates between the presentation and domain layers.

## Structure

```
src/
├── use-cases/          # Application use cases and business workflows
├── commands/           # Command objects and definitions
├── queries/            # Query objects and definitions
├── handlers/           # Command and query handlers
├── services/           # Application services and orchestration logic
├── dto/                # Data transfer objects
└── index.ts           # Main exports
```

## Usage

```typescript
import { CreateUserUseCase } from '@project/application/use-cases';
import { CreateUserCommand } from '@project/application/commands';
import { UserApplicationService } from '@project/application/services';

// Use case example
const createUserUseCase = new CreateUserUseCase(userRepository, eventBus);
const result = await createUserUseCase.execute(createUserRequest);

// Command example
const command = new CreateUserCommand({ name: 'John', email: 'john@example.com' });
await commandBus.execute(command);

// Application service example
const userService = new UserApplicationService(userRepository, eventBus);
const user = await userService.createUser(userData);
```

## Key Concepts

- **Use Cases**: Encapsulate application-specific business rules and workflows
- **Commands**: Represent requests to change system state
- **Queries**: Represent requests to retrieve data
- **Handlers**: Process commands and queries
- **Application Services**: Coordinate between use cases and external concerns
- **DTOs**: Transfer data across application boundaries