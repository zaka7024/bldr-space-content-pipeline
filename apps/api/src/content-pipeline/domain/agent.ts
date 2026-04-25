import { ToolLoopAgent } from 'ai';
import { openai } from "@ai-sdk/openai";

const agent = new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: 'You are a helpful assistant.',
  tools: {
    // Your tools here
  },
});

export function generate(input: string) {
  return agent.generate({
    prompt: input,
  })
}
