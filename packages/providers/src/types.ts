export interface Message {
  role: 'user' | 'assistant' | 'system' | 'developer';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  systemPrompt?: string;
  messages: Message[];
  stream?: boolean;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface Provider {
  name: string;
  complete(options: CompletionOptions): Promise<CompletionResult>;
}
