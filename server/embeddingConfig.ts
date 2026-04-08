export type EmbeddingProvider = 'openai' | 'gateway';

const DEFAULT_EMBEDDING_PROVIDER: EmbeddingProvider = 'openai';
const DEFAULT_EMBEDDING_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

function readConfiguredValue(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

function resolveGatewayEmbeddingApiKey() {
  return readConfiguredValue(process.env.EMBEDDING_GATEWAY_API_KEY) || readConfiguredValue(process.env.AI_GATEWAY_API_KEY);
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const raw = readConfiguredValue(process.env.EMBEDDING_PROVIDER)?.toLowerCase();

  if (raw === 'gateway') {
    return 'gateway';
  }

  return DEFAULT_EMBEDDING_PROVIDER;
}

export function hasEmbeddingCredentials() {
  const provider = getEmbeddingProvider();

  if (provider === 'gateway') {
    return !!resolveGatewayEmbeddingApiKey();
  }

  return !!readConfiguredValue(process.env.OPENAI_API_KEY);
}

export function getEmbeddingGatewayBaseUrl() {
  const baseUrl = readConfiguredValue(process.env.EMBEDDING_GATEWAY_BASE_URL) || DEFAULT_EMBEDDING_GATEWAY_BASE_URL;

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function normalizeEmbeddingModelForProvider(model: string, provider: EmbeddingProvider) {
  const normalizedModel = model.trim();

  if (provider !== 'gateway') {
    return normalizedModel;
  }

  if (normalizedModel.includes('/')) {
    return normalizedModel;
  }

  return `openai/${normalizedModel}`;
}

export function resolveEmbeddingClientConfig(purpose: string) {
  const provider = getEmbeddingProvider();

  if (provider === 'gateway') {
    const apiKey = resolveGatewayEmbeddingApiKey();

    if (!apiKey) {
      throw new Error(
        `AI_GATEWAY_API_KEY (or EMBEDDING_GATEWAY_API_KEY) is required for ${purpose} when EMBEDDING_PROVIDER=gateway.`,
      );
    }

    return {
      provider,
      apiKey,
      baseURL: getEmbeddingGatewayBaseUrl(),
    };
  }

  const apiKey = readConfiguredValue(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(`OPENAI_API_KEY is required for ${purpose} when EMBEDDING_PROVIDER=openai.`);
  }

  return {
    provider,
    apiKey,
  };
}
