export {};

declare global {
  type LanguageModelAvailability =
    | "unavailable"
    | "available"
    | "downloadable"
    | "downloading";

  type LanguageModelPromptRole = "system" | "user" | "assistant";

  interface LanguageModelPrompt {
    role: LanguageModelPromptRole;
    content: string;
  }

  interface LanguageModelSession {
    prompt(input: string): Promise<string>;
  }

  interface LanguageModelCreateOptions {
    initialPrompts: LanguageModelPrompt[];
    topK?: number;
    temperature?: number;
    // Chrome Prompt API monitor (non-standard EventTarget with custom events).
    monitor?: (m: EventTarget) => void;
  }

  interface LanguageModelAPI {
    availability(): Promise<LanguageModelAvailability>;
    create(options: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  }

  interface Window {
    LanguageModel?: LanguageModelAPI;
    ai?: {
      languageModel?: LanguageModelAPI;
    };
  }
}
