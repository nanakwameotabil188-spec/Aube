import next from 'eslint-config-next';

/**
 * Flat config.
 *
 * `eslint-config-next` exports the flat-config array directly in Next 16, so
 * spreading it keeps the framework's core-web-vitals rules plus the TypeScript
 * and React presets without re-declaring them.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...next,
  {
    rules: {
      '@next/next/no-img-element': 'error',
    },
  },
];

export default config;
