import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { transformSync } from '@babel/core';

function reactNativeNodeModulesJsx() {
  return {
    name: 'react-native-node-modules-jsx',
    enforce: 'pre',
    transform(code, id) {
      if (
        id.includes('node_modules') &&
        id.endsWith('.js') &&
        (id.includes('expo') ||
          id.includes('react-native') ||
          id.includes('@react-native') ||
          id.includes('lucide-react-native'))
      ) {
        try {
          const result = transformSync(code, {
            presets: [
              ['@babel/preset-react', { runtime: 'automatic' }],
              '@babel/preset-flow',
            ],
            filename: id,
            babelrc: false,
            configFile: false,
          });
          return {
            code: result.code,
            map: result.map,
          };
        } catch (e) {
          return null;
        }
      }
      return null;
    },
  };
}

const proxyRules = {
  '/verify-gate-entry': 'http://127.0.0.1:8000',
  '/generate-permanent-qr': 'http://127.0.0.1:8000',
  '/generate-event-qr': 'http://127.0.0.1:8000',
  '/import-student-registry': 'http://127.0.0.1:8000',
  '/sample-student-registry': 'http://127.0.0.1:8000',
  '/register-user': 'http://127.0.0.1:8000',
  '/auto-scan-frame': 'http://127.0.0.1:8000',
  '/network-status': 'http://127.0.0.1:8000',
  '/toggle-network': 'http://127.0.0.1:8000',
  '/sync-queue': 'http://127.0.0.1:8000',
  '/flush-sync-queue': 'http://127.0.0.1:8000',
  '/mobile-session': 'http://127.0.0.1:8000',
  '/users': 'http://127.0.0.1:8000',
  '/events': 'http://127.0.0.1:8000',
  '/gate-logs': 'http://127.0.0.1:8000',
  '/reset-db': 'http://127.0.0.1:8000',
};

export default defineConfig({
  base: './',
  plugins: [
    reactNativeNodeModulesJsx(),
    react(),
  ],
  define: {
    global: 'window',
    __DEV__: JSON.stringify(true),
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['expo-camera', 'react-native-qrcode-svg'],
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      'react-native-svg': 'react-native-svg/lib/commonjs/ReactNativeSVG.web',
    },
    extensions: [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
    ],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: proxyRules,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: proxyRules,
  },
});
