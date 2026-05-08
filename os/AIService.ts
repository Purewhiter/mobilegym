/**
 * System AI Service
 * 
 * Provides a centralized AI chat service for all apps.
 * Supports multiple providers:
 * 1. OpenAI (GPT-4, GPT-3.5, etc.)
 * 2. Anthropic (Claude)
 * 3. Custom API endpoints
 * 4. Mock mode (for testing, returns predefined or random responses)
 * 
 * Configuration is read from SIMULATOR_CONFIG for system-wide settings.
 * All apps should use this service for AI chat functionality.
 */

import { SIMULATOR_CONFIG } from './data';

// ============================================================================
// Types
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  model?: string;                      // Model name (e.g., 'gpt-4', 'claude-3-opus')
  temperature?: number;                // Creativity (0-1), default 0.7
  maxTokens?: number;                  // Max response tokens
  systemPrompt?: string;               // System prompt for personality/context
  provider?: AIProvider;               // Which provider to use
  apiEndpoint?: string;                // Custom API endpoint
  apiKey?: string;                     // API key (overrides global config)
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';  // For reasoning models: control chain-of-thought
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIProvider = 'openai' | 'anthropic' | 'custom' | 'mock';

export interface AIServiceConfig {
  defaultProvider: AIProvider;
  openai?: {
    apiKey: string;
    baseUrl?: string;                  // Default: https://api.openai.com/v1
    defaultModel?: string;             // Default: gpt-4o-mini
  };
  anthropic?: {
    apiKey: string;
    baseUrl?: string;                  // Default: https://api.anthropic.com
    defaultModel?: string;             // Default: claude-3-haiku-20240307
  };
  custom?: {
    apiEndpoint: string;
    apiKey?: string;
    defaultModel?: string;
  };
  mock?: {
    mode: 'echo' | 'random' | 'scripted';
    delay?: number;                    // Simulated response delay in ms
    scriptedResponses?: string[];      // For scripted mode
  };
}

// ============================================================================
// Default Configuration (initialized from SIMULATOR_CONFIG)
// ============================================================================

// Build initial config from SIMULATOR_CONFIG
function buildInitialConfig(): AIServiceConfig {
  const ai = SIMULATOR_CONFIG.ai;
  const config: AIServiceConfig = {
    defaultProvider: ai.enabled ? 'openai' : 'mock',
    mock: {
      mode: 'random',
      delay: ai.replyDelay || 1500,
    },
  };

  if (ai.enabled && ai.baseUrl) {
    config.openai = {
      apiKey: ai.apiKey || '',
      baseUrl: ai.baseUrl,
      defaultModel: ai.model || 'gpt-4o-mini',
    };
  }

  return config;
}

let serviceConfig: AIServiceConfig = buildInitialConfig();

/**
 * Get system default settings from SIMULATOR_CONFIG
 */
export function getSystemDefaults() {
  const ai = SIMULATOR_CONFIG.ai;
  return {
    enabled: ai.enabled,
    baseUrl: ai.baseUrl,
    model: ai.model,
    apiKey: ai.apiKey,
    temperature: ai.temperature,
    replyDelay: ai.replyDelay,
    maxContextMessages: ai.maxContextMessages,
    reasoningEffort: ai.reasoningEffort,
  };
}

// Random mock responses for testing
const MOCK_RESPONSES = [
  '好的，我明白了。',
  '这个想法不错！',
  '让我想想...',
  '哈哈，有意思。',
  '嗯嗯，说得对。',
  '我也这么觉得。',
  '原来如此！',
  '谢谢你告诉我。',
  '没问题！',
  '好的，我知道了。',
  '这样啊，我了解了。',
  '可以的，没问题。',
  '我同意你的看法。',
  '有道理！',
  '好主意！',
];

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Initialize the AI service with configuration
 */
export function initAIService(config: Partial<AIServiceConfig>): void {
  serviceConfig = { ...serviceConfig, ...config };
}

/**
 * Get current AI service configuration
 */
export function getAIConfig(): AIServiceConfig {
  return { ...serviceConfig };
}

/**
 * Set the default AI provider
 */
export function setDefaultProvider(provider: AIProvider): void {
  serviceConfig.defaultProvider = provider;
}

/**
 * Configure OpenAI settings
 */
export function configureOpenAI(config: NonNullable<AIServiceConfig['openai']>): void {
  serviceConfig.openai = config;
}

/**
 * Configure Anthropic settings
 */
export function configureAnthropic(config: NonNullable<AIServiceConfig['anthropic']>): void {
  serviceConfig.anthropic = config;
}

/**
 * Configure custom provider settings
 */
export function configureCustomProvider(config: NonNullable<AIServiceConfig['custom']>): void {
  serviceConfig.custom = config;
}

/**
 * Configure mock mode settings
 */
export function configureMock(config: NonNullable<AIServiceConfig['mock']>): void {
  serviceConfig.mock = config;
}

// ============================================================================
// Core Chat Function
// ============================================================================

/**
 * Send a chat completion request
 * 
 * @param messages - Array of messages in the conversation
 * @param options - Request options
 * @returns Promise<AIResponse>
 */
export async function chat(
  messages: AIMessage[],
  options: AIRequestOptions = {}
): Promise<AIResponse> {
  const provider = options.provider || serviceConfig.defaultProvider;

  switch (provider) {
    case 'openai':
      return callOpenAI(messages, options);
    case 'anthropic':
      return callAnthropic(messages, options);
    case 'custom':
      return callCustomAPI(messages, options);
    case 'mock':
    default:
      return mockResponse(messages, options);
  }
}

/**
 * Simple chat - send a single message and get a response
 * Convenience function for simple use cases
 */
export async function simpleChat(
  userMessage: string,
  systemPrompt?: string,
  options: AIRequestOptions = {}
): Promise<AIResponse> {
  const messages: AIMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: userMessage });
  
  return chat(messages, options);
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Call OpenAI API
 */
async function callOpenAI(
  messages: AIMessage[],
  options: AIRequestOptions
): Promise<AIResponse> {
  const config = serviceConfig.openai;
  const apiKey = options.apiKey || config?.apiKey || '';
  const baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
  if (!apiKey && baseUrl === 'https://api.openai.com/v1') {
    return { success: false, error: 'OpenAI API key not configured' };
  }

  const model = options.model || config?.defaultModel || 'gpt-4o-mini';
  const reasoningEffort = options.reasoningEffort || SIMULATOR_CONFIG.ai.reasoningEffort;

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    messages: options.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  // Add reasoning_effort for reasoning models (o1/o3/GPT-5)
  // This controls chain-of-thought: 'none' disables it, 'low'/'medium'/'high' for different levels
  if (reasoningEffort) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  messages: AIMessage[],
  options: AIRequestOptions
): Promise<AIResponse> {
  const config = serviceConfig.anthropic;
  if (!config?.apiKey && !options.apiKey) {
    return { success: false, error: 'Anthropic API key not configured' };
  }

  const apiKey = options.apiKey || config!.apiKey;
  const baseUrl = config?.baseUrl || 'https://api.anthropic.com';
  const model = options.model || config?.defaultModel || 'claude-3-haiku-20240307';

  // Convert messages to Anthropic format
  const systemMessage = options.systemPrompt || messages.find(m => m.role === 'system')?.content;
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  try {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 1024,
        system: systemMessage,
        messages: nonSystemMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      content: data.content[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Anthropic request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Call custom API endpoint
 */
async function callCustomAPI(
  messages: AIMessage[],
  options: AIRequestOptions
): Promise<AIResponse> {
  const config = serviceConfig.custom;
  const endpoint = options.apiEndpoint || config?.apiEndpoint;
  
  if (!endpoint) {
    return { success: false, error: 'Custom API endpoint not configured' };
  }

  const apiKey = options.apiKey || config?.apiKey;
  const model = options.model || config?.defaultModel;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: options.systemPrompt
          ? [{ role: 'system', content: options.systemPrompt }, ...messages]
          : messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Custom API error: ${response.status} - ${response.statusText}`,
      };
    }

    const data = await response.json();
    // Try to parse common response formats
    const content = data.choices?.[0]?.message?.content 
      || data.content?.[0]?.text 
      || data.response 
      || data.text
      || data.message
      || '';

    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: `Custom API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generate mock response (for testing)
 */
async function mockResponse(
  messages: AIMessage[],
  options: AIRequestOptions
): Promise<AIResponse> {
  const config = serviceConfig.mock || { mode: 'random', delay: 1000 };
  
  // Simulate network delay
  const delay = config.delay ?? 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  let content: string;

  switch (config.mode) {
    case 'echo':
      // Echo the last user message
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      content = lastUserMsg ? `收到: "${lastUserMsg.content}"` : '你好！';
      break;

    case 'scripted':
      // Return scripted responses in order
      if (config.scriptedResponses && config.scriptedResponses.length > 0) {
        const idx = messages.filter(m => m.role === 'assistant').length % config.scriptedResponses.length;
        content = config.scriptedResponses[idx];
      } else {
        content = '嗯嗯，好的。';
      }
      break;

    case 'random':
    default:
      // Return random response from pool
      content = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      break;
  }

  return {
    success: true,
    content,
    usage: {
      promptTokens: messages.reduce((sum, m) => sum + m.content.length, 0),
      completionTokens: content.length,
      totalTokens: messages.reduce((sum, m) => sum + m.content.length, 0) + content.length,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build messages array from chat history
 * Useful for converting app-specific message formats to AIMessage format
 */
export function buildMessagesFromHistory(
  history: Array<{ content: string; isUser: boolean }>,
  systemPrompt?: string,
  maxMessages: number = 20
): AIMessage[] {
  const messages: AIMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  // Take only the last N messages
  const recentHistory = history.slice(-maxMessages);
  
  for (const msg of recentHistory) {
    messages.push({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content,
    });
  }
  
  return messages;
}

/**
 * Estimate token count (rough approximation)
 * Chinese: ~1.5 tokens per character
 * English: ~0.25 tokens per word (~4 chars)
 */
export function estimateTokens(text: string): number {
  // Simple heuristic: assume ~1.5 tokens per character for Chinese-heavy text
  // This is a rough estimate; actual tokenization varies by model
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.3);
}

// ============================================================================
// Window Export (for external access)
// ============================================================================

if (typeof window !== 'undefined') {
  window.__SIM_AI__ = {
    chat,
    simpleChat,
    init: initAIService,
    getConfig: getAIConfig,
    getSystemDefaults,
    setProvider: setDefaultProvider,
    configureOpenAI,
    configureAnthropic,
    configureCustom: configureCustomProvider,
    configureMock,
    buildMessages: buildMessagesFromHistory,
    estimateTokens,
  };
}
