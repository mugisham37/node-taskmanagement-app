#!/usr/bin/env node

/**
 * React Component Generator
 * Generates React components with TypeScript, tests, and stories
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Component templates
const templates = {
  component: (name, props) => `import React from 'react';
import { cn } from '@taskmanagement/utils';
${props.withStyles ? `import styles from './${name}.module.css';` : ''}

export interface ${name}Props {
  className?: string;
  children?: React.ReactNode;
  ${props.customProps || ''}
}

export const ${name}: React.FC<${name}Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div 
      className={cn(
        '${props.baseClasses || 'flex items-center justify-center'}',
        ${props.withStyles ? `styles.${name.toLowerCase()},` : ''}
        className
      )}
      {...props}
    >
      {children || <span>${name} Component</span>}
    </div>
  );
};

${name}.displayName = '${name}';

export default ${name};`,

  test: (name) => `import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ${name} } from './${name}';

describe('${name}', () => {
  it('renders without crashing', () => {
    render(<${name} />);
    expect(screen.getByText('${name} Component')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-class';
    render(<${name} className={customClass} />);
    const element = screen.getByText('${name} Component');
    expect(element.parentElement).toHaveClass(customClass);
  });

  it('renders children when provided', () => {
    const childText = 'Custom child content';
    render(<${name}>{childText}</${name}>);
    expect(screen.getByText(childText)).toBeInTheDocument();
    expect(screen.queryByText('${name} Component')).not.toBeInTheDocument();
  });

  it('forwards additional props', () => {
    const testId = 'test-${name.toLowerCase()}';
    render(<${name} data-testid={testId} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });
});`,

  story: (name, props) => `import type { Meta, StoryObj } from '@storybook/react';
import { ${name} } from './${name}';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A reusable ${name} component with TypeScript support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes to apply',
    },
    children: {
      control: 'text',
      description: 'Content to render inside the component',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithCustomContent: Story = {
  args: {
    children: 'Custom ${name} content',
  },
};

export const WithCustomClass: Story = {
  args: {
    className: 'bg-blue-100 p-4 rounded-lg',
    children: 'Styled ${name}',
  },
};

${props.withVariants ? `
export const Variants: Story = {
  render: () => (
    <div className="space-y-4">
      <${name}>Default ${name}</${name}>
      <${name} className="bg-red-100">Red variant</${name}>
      <${name} className="bg-green-100">Green variant</${name}>
      <${name} className="bg-blue-100">Blue variant</${name}>
    </div>
  ),
};` : ''}`,

  styles: (name) => `.${name.toLowerCase()} {
  /* Component-specific styles */
  display: flex;
  align-items: center;
  justify-content: center;
}

.${name.toLowerCase()}:hover {
  /* Hover styles */
}

.${name.toLowerCase()}:focus {
  /* Focus styles */
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}`,

  index: (name) => `export { ${name}, type ${name}Props } from './${name}';`,
};

// Utility functions
const toPascalCase = (str) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
    .replace(/^./, (char) => char.toUpperCase());
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log.info(`Created directory: ${dirPath}`);
  }
};

const writeFile = (filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf8');
  log.success(`Created: ${filePath}`);
};

const generateComponent = (options) => {
  const {
    name: rawName,
    path: targetPath = 'src/components',
    withTest = true,
    withStory = true,
    withStyles = false,
    withIndex = true,
    customProps = '',
    baseClasses = '',
    withVariants = false,
  } = options;

  // Normalize component name
  const name = toPascalCase(rawName);
  
  // Create component directory
  const componentDir = path.join(process.cwd(), targetPath, name);
  ensureDirectoryExists(componentDir);

  // Generate component file
  const componentContent = templates.component(name, {
    withStyles,
    customProps,
    baseClasses,
  });
  writeFile(path.join(componentDir, `${name}.tsx`), componentContent);

  // Generate test file
  if (withTest) {
    const testContent = templates.test(name);
    writeFile(path.join(componentDir, `${name}.test.tsx`), testContent);
  }

  // Generate story file
  if (withStory) {
    const storyContent = templates.story(name, { withVariants });
    writeFile(path.join(componentDir, `${name}.stories.tsx`), storyContent);
  }

  // Generate styles file
  if (withStyles) {
    const stylesContent = templates.styles(name);
    writeFile(path.join(componentDir, `${name}.module.css`), stylesContent);
  }

  // Generate index file
  if (withIndex) {
    const indexContent = templates.index(name);
    writeFile(path.join(componentDir, 'index.ts'), indexContent);
  }

  log.success(`Component ${name} generated successfully!`);
  
  // Update main components index if it exists
  updateMainIndex(targetPath, name);
};

const updateMainIndex = (targetPath, componentName) => {
  const mainIndexPath = path.join(process.cwd(), targetPath, 'index.ts');
  
  if (fs.existsSync(mainIndexPath)) {
    const currentContent = fs.readFileSync(mainIndexPath, 'utf8');
    const exportLine = `export * from './${componentName}';`;
    
    if (!currentContent.includes(exportLine)) {
      const newContent = currentContent + '\n' + exportLine;
      fs.writeFileSync(mainIndexPath, newContent, 'utf8');
      log.success(`Updated main index: ${mainIndexPath}`);
    }
  } else {
    // Create main index file
    const indexContent = `export * from './${componentName}';`;
    writeFile(mainIndexPath, indexContent);
  }
};

// CLI interface
const showHelp = () => {
  console.log(`
${colors.cyan}React Component Generator${colors.reset}

Usage: node component.js <component-name> [options]

Options:
  --path <path>         Target directory (default: src/components)
  --no-test            Skip test file generation
  --no-story           Skip story file generation
  --with-styles        Generate CSS module file
  --no-index           Skip index file generation
  --props <props>      Custom props for the component
  --classes <classes>  Base CSS classes
  --with-variants      Include variant examples in stories
  -h, --help           Show this help message

Examples:
  node component.js Button
  node component.js UserCard --path src/features/user/components
  node component.js Modal --with-styles --props "isOpen: boolean; onClose: () => void;"
  node component.js Badge --classes "inline-flex items-center px-2 py-1 rounded"
  node component.js Alert --with-variants --with-styles
`);
};

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const options = {
    name: args[0],
    withTest: true,
    withStory: true,
    withStyles: false,
    withIndex: true,
    withVariants: false,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--path':
        options.path = args[++i];
        break;
      case '--no-test':
        options.withTest = false;
        break;
      case '--no-story':
        options.withStory = false;
        break;
      case '--with-styles':
        options.withStyles = true;
        break;
      case '--no-index':
        options.withIndex = false;
        break;
      case '--with-variants':
        options.withVariants = true;
        break;
      case '--props':
        options.customProps = args[++i];
        break;
      case '--classes':
        options.baseClasses = args[++i];
        break;
      default:
        log.warning(`Unknown option: ${arg}`);
        break;
    }
  }

  return options;
};

// Main execution
const main = () => {
  try {
    const options = parseArgs();
    
    if (!options.name) {
      log.error('Component name is required');
      showHelp();
      process.exit(1);
    }

    log.info(`Generating React component: ${options.name}`);
    generateComponent(options);
    
    log.info('');
    log.info('Next steps:');
    log.info('1. Import and use your component');
    log.info('2. Run tests: npm test');
    log.info('3. View in Storybook: npm run storybook');
    
  } catch (error) {
    log.error(`Failed to generate component: ${error.message}`);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateComponent,
  templates,
  toPascalCase,
};