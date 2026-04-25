import { ToolLoopAgent } from 'ai';
import { openai } from "@ai-sdk/openai";
import { scrapeInstagram, scrapeFacebook } from './tools/index.js';

const agent = new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: 'You are a helpful assistant.',
  tools: {
    scrapeInstagram,
    scrapeFacebook,
  },
});

export function generate(input: string) {
  return agent.generate({
    prompt: input,
  })
}
