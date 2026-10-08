import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  optimizeDeps: {
    include: [
      '@reown/appkit',
      '@reown/appkit-adapter-ethers',
      '@reown/appkit-adapter-solana',
      '@reown/appkit-adapter-bitcoin',
      '@reown/appkit/networks',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@reown/appkit-adapter-ethers') || id.includes('/ethers/')) return 'reown-ethers';
          if (id.includes('@reown/appkit-adapter-solana') || id.includes('@solana/')) return 'reown-solana';
          if (id.includes('@reown/appkit-adapter-bitcoin')) return 'reown-bitcoin';
          if (id.includes('@walletconnect')) return 'walletconnect';
          if (id.includes('@reown/appkit-ui') || id.includes('@reown/appkit-scaffold-ui')) return 'reown-ui';
          if (id.includes('@reown/appkit-controllers')) return 'reown-controllers';
          if (id.includes('@reown/appkit')) return 'reown-core';
          if (id.includes('@coinbase/wallet-sdk') || id.includes('@cbhq/')) return 'coinbase-wallet';
          if (id.includes('@base-org/') || id.includes('@base/')) return 'base-wallet';
          if (id.includes('/viem/_esm/chains') || id.includes('/viem/_esm/constants')) return 'viem-chains';
          if (id.includes('/viem/_esm/accounts') || id.includes('/viem/_esm/account-abstraction')) return 'viem-accounts';
          if (id.includes('/viem/_esm/actions')) return 'viem-actions';
          if (id.includes('/viem/_esm/clients')) return 'viem-clients';
          if (id.includes('/viem/_esm/ens') || id.includes('/viem/_esm/experimental')) return 'viem-extras';
          if (id.includes('/viem/_esm/utils') || id.includes('/viem/_esm/errors')) return 'viem-utils';
          if (id.includes('viem') || id.includes('ox-') || id.includes('@noble/')) return 'viem-core';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'react-dom';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'react-router';
          if (id.includes('three')) return 'three';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'recharts';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'framer';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('lodash')) return 'lodash';
          if (id.includes('react-leaflet') || id.includes('leaflet')) return 'leaflet';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('@hello-pangea')) return 'dnd';
          if (id.includes('html2canvas')) return 'html2canvas';
          if (id.includes('jspdf')) return 'jspdf';
        },
      },
    },
  },
});