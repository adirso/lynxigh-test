import { prisma } from '../db.js';
import { loadEnv } from '../env.js';
import { createAiService } from './create-ai-service.js';
import { AiGenerationError } from './ai-port.js';
import type { GenerateDescriptionPhoto } from './ai-port.js';
import { ValidationError, ServiceUnavailableError, BadGatewayError } from '../errors.js';

// Deliberately NOT cached at module scope (contrast items.service.ts's
// `const storage = createStorage(loadEnv())`) — recomputed per call so tests
// can flip OPENAI_API_KEY on/off per-test via process.env overrides (the
// same pattern src/auth/jwt.ts uses for JWT_SECRET), independent of
// whatever happens to be in the developer's real .env file.
export function isAiAvailable(): boolean {
  return createAiService(loadEnv()) !== null;
}

export type GenerateDescriptionServiceInput = {
  title: string;
  categoryId?: string;
  condition: string;
  options: string[];
  photos: GenerateDescriptionPhoto[];
};

export async function generateDescription(input: GenerateDescriptionServiceInput): Promise<string> {
  const aiService = createAiService(loadEnv());
  if (!aiService) {
    throw new ServiceUnavailableError('AI description generation is not configured');
  }

  let categoryName: string | undefined;
  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new ValidationError('categoryId does not reference an existing category');
    }
    categoryName = category.name;
  }

  try {
    return await aiService.generateDescription({
      title: input.title,
      categoryName,
      condition: input.condition,
      options: input.options,
      photos: input.photos,
    });
  } catch (err) {
    if (err instanceof AiGenerationError) {
      console.error('AI generation failed:', err);
      throw new BadGatewayError('AI description generation failed');
    }
    throw err;
  }
}
