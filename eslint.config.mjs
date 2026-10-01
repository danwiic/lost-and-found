import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'uploads/**',
      '.model-cache/**',
    ],
  },
  ...nextCoreWebVitals,
]

export default config
