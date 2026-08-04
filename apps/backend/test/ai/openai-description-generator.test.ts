import { describe, it, expect, vi } from 'vitest';
import { OpenAiDescriptionGenerator } from '../../src/ai/openai-description-generator.js';
import { AiGenerationError } from '../../src/ai/ai-port.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('OpenAiDescriptionGenerator', () => {
  it('sends the model, prompt, and base64-encoded photos (capped at 4) to the chat completions endpoint', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'A great desk.' } }] }));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    const photos = Array.from({ length: 6 }, (_, i) => ({
      buffer: Buffer.from(`photo-${i}`),
      mimeType: 'image/jpeg',
    }));

    await generator.generateDescription({
      title: 'Standing Desk',
      categoryName: 'Furniture',
      condition: 'Good',
      options: ['Local pickup'],
      photos,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    const content = body.messages[0].content as Array<Record<string, unknown>>;
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('Standing Desk');
    expect(content[0].text).toContain('Furniture');
    expect(content[0].text).toContain('Good');
    expect(content[0].text).toContain('Local pickup');

    const imageParts = content.filter((part) => part.type === 'image_url');
    expect(imageParts).toHaveLength(4);
    expect((imageParts[0].image_url as { url: string }).url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('omits the Category line from the prompt when no categoryName is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'Nice item.' } }] }));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    await generator.generateDescription({
      title: 'Mystery Item',
      condition: 'Fair',
      options: [],
      photos: [{ buffer: Buffer.from('x'), mimeType: 'image/png' }],
    });

    const init = fetchImpl.mock.calls[0][1];
    const body = JSON.parse(init.body as string);
    const text = body.messages[0].content[0].text as string;
    expect(text).not.toContain('Category:');
  });

  it('trims whitespace and strips wrapping quotes from the returned text', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: '  "A lovely lamp."  ' } }] }));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    const result = await generator.generateDescription({
      title: 'Lamp',
      condition: 'New',
      options: [],
      photos: [{ buffer: Buffer.from('x'), mimeType: 'image/png' }],
    });

    expect(result).toBe('A lovely lamp.');
  });

  it('throws AiGenerationError when the fetch itself fails (network error)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    await expect(
      generator.generateDescription({ title: 'X', condition: 'Good', options: [], photos: [] }),
    ).rejects.toThrow(AiGenerationError);
  });

  it('throws AiGenerationError when OpenAI responds with a non-2xx status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'rate limited' }, 429));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    await expect(
      generator.generateDescription({ title: 'X', condition: 'Good', options: [], photos: [] }),
    ).rejects.toThrow(AiGenerationError);
  });

  it('throws AiGenerationError when the response has no message content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [] }));
    const generator = new OpenAiDescriptionGenerator('sk-test', 'gpt-4o-mini', fetchImpl);

    await expect(
      generator.generateDescription({ title: 'X', condition: 'Good', options: [], photos: [] }),
    ).rejects.toThrow(AiGenerationError);
  });
});
