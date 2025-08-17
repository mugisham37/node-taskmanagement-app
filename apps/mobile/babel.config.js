module.exports = function (api) {
  api.cache(true);
  
  return {
    presets: [
      'babel-preset-expo',
      ['@babel/preset-env', { targets: { node: 'current' } }],
      '@babel/preset-typescript',
    ],
    plugins: [
      // Required for expo-router
      'expo-router/babel',
      
      // Reanimated plugin (must be last)
      'react-native-reanimated/plugin',
      
      // Module resolver for absolute imports
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: [
            '.ios.ts',
            '.android.ts',
            '.native.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.native.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@services': './src/services',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@store': './src/store',
            '@types': './src/types',
            '@config': './src/config',
            '@styles': './src/styles',
            '@assets': './src/assets',
          },
        },
      ],
      
      // Transform imports for better tree shaking
      [
        'transform-imports',
        {
          '@expo/vector-icons': {
            transform: '@expo/vector-icons/{{member}}',
            skipDefaultConversion: true,
          },
          'react-native-vector-icons': {
            transform: 'react-native-vector-icons/{{member}}',
            skipDefaultConversion: true,
          },
        },
      ],
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log statements in production
          'transform-remove-console',
        ],
      },
    },
  };
};