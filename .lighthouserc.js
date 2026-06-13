module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm --filter @docflow/web-builder run start',
      url: ['http://localhost:3000/', 'http://localhost:3000/editor'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 1.0 }],
        'categories:seo': ['error', { minScore: 1.0 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
