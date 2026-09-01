// Ambient type declarations for packages without TypeScript definitions

declare module 'three' {
  const content: any;
  export = content;
  export as namespace THREE;
}

// Extend window with third-party payment globals
interface Window {
  paypal: any;
  google: any;
}

// Vite import.meta.env
interface ImportMeta {
  env: {
    [key: string]: any;
    MODE: string;
    BASE_URL: string;
    PROD: boolean;
    DEV: boolean;
    SSR: boolean;
  };
}
