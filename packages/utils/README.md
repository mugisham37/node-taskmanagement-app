# @taskmanagement/utils

Shared utility functions for the task management monolith. This package provides a comprehensive set of utilities for date manipulation, ID generation, performance monitoring, caching, error handling, and more.

## Installation

```bash
npm install @taskmanagement/utils
```

## Usage

### Date Utilities

```typescript
import { DateUtils } from '@taskmanagement/utils/date';

// Check if date is in the past
const isPast = DateUtils.isPast(new Date('2023-01-01'));

// Add days to a date
const futureDate = DateUtils.addDays(new Date(), 7);

// Get start of day
const startOfDay = DateUtils.startOfDay(new Date());
```

### ID Generation

```typescript
import { IdGenerator } from '@taskmanagement/utils/crypto';

// Generate a unique ID
const id = IdGenerator.generate();

// Generate UUID
const uuid = IdGenerator.generateUuid();

// Generate custom length ID
const shortId = IdGenerator.generateWithLength(8);
```

### Response Formatting

```typescript
import { successResponse, errorResponse } from '@taskmanagement/utils/formatting';

// In your Express route
app.get('/api/users', (req, res) => {
  const users = getUsersFromDatabase();
  return successResponse(res, 200, users, 'Users retrieved successfully');
});
```

### Performance Monitoring

```typescript
import { performanceMonitor, getPerformanceStats } from '@taskmanagement/utils';

// Use as Express middleware
app.use(performanceMonitor);

// Get performance statistics
const stats = getPerformanceStats();
```

### Caching

```typescript
import { get, set, getOrSet } from '@taskmanagement/utils';

// Basic cache operations
await set('key', 'value', 300); // TTL: 5 minutes
const value = await get('key');

// Get or set pattern
const data = await getOrSet('expensive-operation', async () => {
  return await expensiveOperation();
}, 600);
```

### Error Handling

```typescript
import { AppError, ValidationError, asyncHandler } from '@taskmanagement/utils';

// Create custom errors
throw new ValidationError('Invalid input data', validationErrors);

// Wrap async route handlers
const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json(user);
});
```

### API Features (Query Building)

```typescript
import { APIFeatures } from '@taskmanagement/utils';

// In your route handler
const features = new APIFeatures(db, tasksTable, req.query)
  .filter()
  .sort()
  .limitFields()
  .paginate()
  .search(['title', 'description']);

const result = await features.execute();
```

## Available Utilities

### Date Utilities (`DateUtils`)
- `isPast(date)` - Check if date is in the past
- `isFuture(date)` - Check if date is in the future
- `isToday(date)` - Check if date is today
- `addDays(date, days)` - Add days to a date
- `addHours(date, hours)` - Add hours to a date
- `startOfDay(date)` - Get start of day
- `endOfDay(date)` - Get end of day
- `daysBetween(date1, date2)` - Calculate days between dates

### ID Generation (`IdGenerator`)
- `generate()` - Generate unique nanoid
- `generateUuid()` - Generate UUID v4
- `generateWithLength(length)` - Generate ID with custom length
- `generatePrefixedId(prefix)` - Generate prefixed ID
- `generateUrlSafeId(length)` - Generate URL-safe ID

### String Utilities (`StringUtils`)
- `capitalize(str)` - Capitalize first letter
- `toCamelCase(str)` - Convert to camelCase
- `toKebabCase(str)` - Convert to kebab-case
- `toSnakeCase(str)` - Convert to snake_case
- `truncate(str, length, suffix)` - Truncate string
- `stripHtml(str)` - Remove HTML tags
- `escapeHtml(str)` - Escape HTML characters
- `slugify(str)` - Create URL-friendly slug
- `isEmail(str)` - Validate email format
- `isUrl(str)` - Validate URL format

### Array Utilities (`ArrayUtils`)
- `unique(array)` - Remove duplicates
- `uniqueBy(array, key)` - Remove duplicates by key
- `chunk(array, size)` - Split into chunks
- `flatten(array)` - Flatten nested arrays
- `groupBy(array, key)` - Group by key
- `sortBy(array, key, direction)` - Sort by key
- `intersection(...arrays)` - Find common elements
- `difference(array1, array2)` - Find different elements
- `shuffle(array)` - Shuffle randomly
- `paginate(array, page, limit)` - Paginate array

### Object Utilities (`ObjectUtils`)
- `deepClone(obj)` - Deep clone object
- `deepMerge(target, ...sources)` - Deep merge objects
- `get(obj, path, defaultValue)` - Get nested property
- `set(obj, path, value)` - Set nested property
- `has(obj, path)` - Check if has nested property
- `pick(obj, keys)` - Pick specific properties
- `omit(obj, keys)` - Omit specific properties
- `flatten(obj, prefix)` - Flatten nested object
- `isEmpty(obj)` - Check if empty

### Math Utilities (`MathUtils`)
- `clamp(value, min, max)` - Clamp number between bounds
- `randomBetween(min, max)` - Random integer in range
- `randomFloat(min, max)` - Random float in range
- `round(value, decimals)` - Round to decimal places
- `percentage(value, total)` - Calculate percentage
- `distance(x1, y1, x2, y2)` - Distance between points
- `isPrime(n)` - Check if number is prime
- `fibonacci(n)` - Calculate fibonacci number
- `average(...numbers)` - Calculate average
- `median(...numbers)` - Calculate median

### Response Formatting
- `successResponse(res, statusCode, data, message, meta)` - Send success response
- `errorResponse(res, statusCode, message, errors, code)` - Send error response
- `paginatedResponse(res, statusCode, data, pagination, message)` - Send paginated response
- `createdResponse(res, data, message, location)` - Send 201 created response
- `validationErrorResponse(res, errors, message)` - Send validation error response

### Performance Monitoring
- `performanceMonitor` - Express middleware for request monitoring
- `getPerformanceStats()` - Get performance statistics
- `profileFunction(fn, name)` - Profile function execution
- `createTimer(label)` - Create performance timer

### Caching
- `get(key)` - Get value from cache
- `set(key, value, ttl)` - Set value in cache
- `del(key)` - Delete value from cache
- `getOrSet(key, fn, ttl)` - Get or set pattern
- `memoize(fn, keyGenerator, ttl)` - Memoize function

### Error Handling
- `AppError` - Base application error class
- `ValidationError` - Validation error class
- `NotFoundError` - Not found error class
- `asyncHandler(fn)` - Async error wrapper
- `normalizeError(error)` - Convert unknown errors to AppError

### API Features
- `APIFeatures` - Query builder for filtering, sorting, pagination
- `safeAnd(...conditions)` - Safe SQL AND conditions
- `safeOr(...conditions)` - Safe SQL OR conditions

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run dev

# Type check
npm run type-check

# Lint code
npm run lint
```

## License

MIT