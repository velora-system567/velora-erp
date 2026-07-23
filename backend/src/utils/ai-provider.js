/**
 * AI Provider Abstraction Layer
 *
 * Supports multiple LLM providers with a unified interface.
 * To add a new provider: implement the send() method.
 *
 * Configure via environment:
 *   AI_PROVIDER=openai|anthropic|gemini|ollama
 *   AI_API_KEY=sk-...
 *   AI_MODEL=gpt-4|claude-3|gemini-pro|llama3
 */

import { env } from "../config/env.js";

class BaseProvider {
  constructor(config) { this.config = config; }
  async send(_messages) { throw new Error("Not implemented"); }
}

class OpenAIProvider extends BaseProvider {
  async send(messages) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model || "gpt-4o-mini", messages, temperature: this.config.temperature || 0.3, max_tokens: 2000 }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

class AnthropicProvider extends BaseProvider {
  async send(messages) {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.config.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model || "claude-3-haiku-20240307", system: systemMsg?.content || "", messages: userMessages, max_tokens: 2000, temperature: this.config.temperature || 0.3 }),
    });
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || "";
  }
}

class OllamaProvider extends BaseProvider {
  async send(messages) {
    const response = await fetch(`${this.config.baseUrl || "http://localhost:11434"}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model || "llama3", messages, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const data = await response.json();
    return data.message?.content || "";
  }
}

const PROVIDERS = { openai: OpenAIProvider, anthropic: AnthropicProvider, gemini: null, ollama: OllamaProvider };

let providerInstance = null;

export function getAIProvider() {
  if (providerInstance) return providerInstance;

  const provider = env.AI_PROVIDER || "openai";
  const ProviderClass = PROVIDERS[provider];
  if (!ProviderClass) {
    throw new Error(`Unsupported AI provider: ${provider}. Supported: ${Object.keys(PROVIDERS).filter((k) => PROVIDERS[k]).join(", ")}`);
  }

  providerInstance = new ProviderClass({
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    temperature: env.AI_TEMPERATURE ? parseFloat(env.AI_TEMPERATURE) : 0.3,
    baseUrl: env.AI_BASE_URL,
  });

  return providerInstance;
}

export function checkAIConfig() {
  const missing = [];
  if (!env.AI_API_KEY && env.AI_PROVIDER !== "ollama") missing.push("AI_API_KEY");
  if (!env.AI_PROVIDER) missing.push("AI_PROVIDER (openai | anthropic | ollama)");
  return missing;
}

export function resetAIProvider() { providerInstance = null; }
