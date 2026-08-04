import type { Env } from '../env.js';
import type { AiPort } from './ai-port.js';
import { OpenAiDescriptionGenerator } from './openai-description-generator.js';

export function createAiService(env: Env): AiPort | null {
  if (!env.openaiApiKey) {
    return null;
  }
  return new OpenAiDescriptionGenerator(env.openaiApiKey, env.openaiModel);
}
