import type { AiPort, GenerateDescriptionInput } from './ai-port.js';
import { AiGenerationError } from './ai-port.js';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
// Vision requests get slower and more expensive per extra image with
// diminishing returns for a short listing description — cap well below
// OpenAI's own per-request image limit.
const MAX_PHOTOS_FOR_PROMPT = 4;

function buildPrompt(input: GenerateDescriptionInput): string {
  const lines = [
    'Write a compelling, honest 2-4 sentence marketplace listing description based on the photo(s) and the details below.',
    'Do not mention or invent a price. Do not use markdown formatting. Return only the description text, nothing else.',
    '',
    `Title: ${input.title || '(not provided)'}`,
  ];
  if (input.categoryName) {
    lines.push(`Category: ${input.categoryName}`);
  }
  lines.push(`Condition: ${input.condition}`);
  if (input.options.length > 0) {
    lines.push(`Notable details: ${input.options.join(', ')}`);
  }
  return lines.join('\n');
}

export class OpenAiDescriptionGenerator implements AiPort {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generateDescription(input: GenerateDescriptionInput): Promise<string> {
    const photos = input.photos.slice(0, MAX_PHOTOS_FOR_PROMPT);
    const content: unknown[] = [{ type: 'text', text: buildPrompt(input) }];
    for (const photo of photos) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${photo.mimeType};base64,${photo.buffer.toString('base64')}` },
      });
    }

    let res: Response;
    try {
      res = await this.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content }],
          max_tokens: 300,
        }),
      });
    } catch (err) {
      throw new AiGenerationError(`Failed to reach OpenAI: ${(err as Error).message}`);
    }

    if (!res.ok) {
      throw new AiGenerationError(`OpenAI request failed with status ${res.status}`);
    }

    const body = await res.json().catch(() => null);
    const text = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message
      ?.content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new AiGenerationError('OpenAI returned no description text');
    }

    return text.trim().replace(/^"+|"+$/g, '');
  }
}
