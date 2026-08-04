import { describe, it, expect } from 'vitest';
import { loadEnv } from '../src/env.js';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret',
};

describe('loadEnv — OpenAI config', () => {
  it('defaults openaiModel to gpt-4o-mini and leaves openaiApiKey undefined when unset', () => {
    const env = loadEnv(BASE_ENV);
    expect(env.openaiApiKey).toBeUndefined();
    expect(env.openaiModel).toBe('gpt-4o-mini');
  });

  it('reads OPENAI_API_KEY and OPENAI_MODEL when set', () => {
    const env = loadEnv({
      ...BASE_ENV,
      OPENAI_API_KEY: 'sk-test-123',
      OPENAI_MODEL: 'gpt-4.1-mini',
    });
    expect(env.openaiApiKey).toBe('sk-test-123');
    expect(env.openaiModel).toBe('gpt-4.1-mini');
  });
});
