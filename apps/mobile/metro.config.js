const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

// 4. Add support for TypeScript files
config.resolver.sourceExts.push('ts', 'tsx');

// 5. Configure asset extensions
config.resolver.assetExts.push(
  // Adds support for `.db` files for SQLite databases
  'db',
  // Add other asset extensions as needed
  'bin',
  'txt',
  'jpg',
  'png',
  'gif',
  'webp',
  'svg',
  'ttf',
  'otf',
  'woff',
  'woff2'
);

// 6. Configure transformer for better performance
config.transformer.minifierConfig = {
  mangle: {
    keep_fnames: true,
  },
};

// 7. Enable symlinks for monorepo packages
config.resolver.unstable_enableSymlinks = true;

// 8. Configure platform-specific extensions
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

module.exports = config;