export type GenerateDescriptionPhoto = {
  buffer: Buffer;
  mimeType: string;
};

export type GenerateDescriptionInput = {
  title: string;
  categoryName?: string;
  condition: string;
  options: string[];
  photos: GenerateDescriptionPhoto[];
};

export interface AiPort {
  generateDescription(input: GenerateDescriptionInput): Promise<string>;
}

export class AiGenerationError extends Error {}
