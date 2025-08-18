// Type declarations for Node.js built-in modules
declare module 'fs' {
  export * from 'node:fs';
}

declare module 'fs/promises' {
  export * from 'node:fs/promises';
}

declare module 'path' {
  export * from 'node:path';
}

declare module 'crypto' {
  export * from 'node:crypto';
}

declare module 'readline' {
  export * from 'node:readline';
}

declare module 'typescript' {
  export * from 'typescript';
}

// Global process declaration
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

// Export for compatibility
export { };

