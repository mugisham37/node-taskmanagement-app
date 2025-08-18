// Node.js built-in modules type declarations
// This file provides type declarations for Node.js built-in modules

/// <reference types="node" />

declare module 'fs' {
  export interface ReadDirOptions {
    withFileTypes?: boolean;
  }
  
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
  }
  
  export interface Stats {
    size: number;
    mtime: Date;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  
  export function readdir(path: string): Promise<string[]>;
  export function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  export function readdir(path: string, options: { withFileTypes?: false }): Promise<string[]>;
  export function readdir(path: string, options: ReadDirOptions): Promise<string[] | Dirent[]>;
  export function stat(path: string): Promise<Stats>;
  
  export namespace promises {
    export function readdir(path: string): Promise<string[]>;
    export function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
    export function readdir(path: string, options: { withFileTypes?: false }): Promise<string[]>;
    export function readdir(path: string, options?: ReadDirOptions): Promise<string[] | Dirent[]>;
    export function stat(path: string): Promise<Stats>;
    export function readFile(path: string): Promise<Buffer>;
    export function readFile(path: string, encoding: BufferEncoding): Promise<string>;
    export function readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    export function writeFile(path: string, data: string | Buffer): Promise<void>;
    export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
    export function access(path: string): Promise<void>;
  }
}

declare module 'fs/promises' {
  export function readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>;
  export function stat(path: string): Promise<Stats>;
  export function readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
  export function writeFile(path: string, data: string | Buffer): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function access(path: string): Promise<void>;
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function dirname(path: string): string;
  export function basename(path: string, ext?: string): string;
  export function extname(path: string): string;
  export const sep: string;
}

declare module 'crypto' {
  export function createHash(algorithm: string): {
    update(data: string | Buffer): any;
    digest(encoding: 'hex' | 'base64'): string;
  };
  export function randomBytes(size: number): Buffer;
  export function createCipher(algorithm: string, password: string): any;
  export function createDecipher(algorithm: string, password: string): any;
}

declare module 'readline' {
  export interface Interface {
    question(query: string, callback: (answer: string) => void): void;
    close(): void;
  }
  
  export function createInterface(options: {
    input: NodeJS.ReadableStream;
    output: NodeJS.WriteableStream;
  }): Interface;
}

declare module 'typescript' {
  export interface SourceFile {
    fileName: string;
    text: string;
  }
  
  export interface Node {
    kind: SyntaxKind;
    getFullText(): string;
    getText(): string;
  }
  
  export enum SyntaxKind {
    ClassDeclaration = 1,
    FunctionDeclaration = 2,
    InterfaceDeclaration = 3,
    // Add more as needed
  }
  
  export function createSourceFile(
    fileName: string,
    sourceText: string,
    languageVersion: ScriptTarget
  ): SourceFile;
  
  export enum ScriptTarget {
    ES2015 = 1,
    ES2018 = 2,
    ES2020 = 3,
    Latest = 99
  }
  
  export function forEachChild<T>(node: Node, cbNode: (node: Node) => T | undefined): T | undefined;
}

// Global Node.js process object
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  stdout: NodeJS.WriteableStream;
  stdin: NodeJS.ReadableStream;
};

// Global Node.js types
declare namespace NodeJS {
  interface ReadableStream {
    read(): any;
  }
  
  interface WriteableStream {
    write(data: string): boolean;
  }
}

export { };

