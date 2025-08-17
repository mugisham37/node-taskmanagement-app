# @taskmanagement/ui

A comprehensive React component library built with TypeScript, Tailwind CSS, and Radix UI primitives for the Task Management application ecosystem.

## Features

- 🎨 **Modern Design System** - Built with Tailwind CSS and design tokens
- ♿ **Accessibility First** - WCAG 2.1 AA compliant components
- 🎭 **Radix UI Primitives** - Unstyled, accessible components as foundation
- 📱 **Responsive** - Mobile-first design approach
- 🌙 **Dark Mode** - Built-in dark mode support
- 📚 **Storybook** - Interactive component documentation
- 🧪 **Well Tested** - Comprehensive test coverage with Vitest
- 📦 **Tree Shakeable** - Optimized bundle size
- 🔧 **TypeScript** - Full type safety

## Installation

```bash
npm install @taskmanagement/ui
# or
pnpm add @taskmanagement/ui
# or
yarn add @taskmanagement/ui
```

## Usage

### Basic Setup

Import the CSS file in your application:

```tsx
import '@taskmanagement/ui/styles';
```

### Using Components

```tsx
import { Button, Input, Card } from '@taskmanagement/ui';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter your name" />
      <Button variant="primary">Submit</Button>
    </Card>
  );
}
```

### Using Hooks

```tsx
import { useLocalStorage, useDebounce } from '@taskmanagement/ui';

function MyComponent() {
  const [value, setValue] = useLocalStorage('key', 'default');
  const debouncedValue = useDebounce(value, 300);
  
  return (
    <input 
      value={value} 
      onChange={(e) => setValue(e.target.value)} 
    />
  );
}
```

## Component Categories

### Input Components
- `Button` - Versatile button component with multiple variants
- `Input` - Text input with validation and helper text
- `IconButton` - Button optimized for icons
- `SearchInput` - Input with search functionality

### Form Components
- `Checkbox` - Accessible checkbox with label support
- `Select` - Dropdown select component
- `RadioGroup` - Radio button group
- `DatePicker` - Date selection component

### Layout Components
- `Container` - Responsive container with size variants
- `Grid` - CSS Grid wrapper with responsive breakpoints
- `Flex` - Flexbox wrapper with alignment utilities
- `Stack` - Vertical layout component

### Data Display
- `Badge` - Status and category indicators
- `Card` - Content container with header/footer
- `Table` - Data table components
- `List` - Ordered and unordered lists
- `Calendar` - Calendar component for date selection

### Feedback Components
- `Alert` - Alert messages with variants
- `Toast` - Notification toasts
- `Spinner` - Loading indicators

### Navigation Components
- `Navbar` - Application navigation bar
- `Sidebar` - Collapsible sidebar navigation
- `Breadcrumb` - Breadcrumb navigation
- `Tabs` - Tab navigation

### Overlay Components
- `Modal` - Modal dialogs
- `Popover` - Popover content
- `Tooltip` - Contextual tooltips
- `Drawer` - Slide-out drawer

## Hooks

### State Management
- `useLocalStorage` - Persistent local storage state
- `useToggle` - Boolean toggle state management
- `useAsync` - Async operation state management

### UI Utilities
- `useDebounce` - Debounce values and callbacks
- `useClickOutside` - Detect clicks outside elements

## Theming

The component library uses CSS custom properties for theming:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  /* ... more theme variables */
}
```

### Dark Mode

Toggle dark mode by adding the `dark` class to your root element:

```tsx
<html className="dark">
  {/* Your app */}
</html>
```

## Development

### Running Storybook

```bash
npm run storybook
```

### Running Tests

```bash
npm test
npm run test:coverage
```

### Building

```bash
npm run build
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new components
3. Update Storybook stories for new components
4. Ensure accessibility compliance
5. Update documentation

## License

MIT License - see LICENSE file for details.