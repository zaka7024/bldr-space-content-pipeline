import { tool } from "ai";
import z from "zod";
import { Exa } from 'exa-js';

export const WEB_SEARCH_TOOL = "WEB_SEARCH_TOOL";

export const createWebSearchTool = (apiKey: string) => {
  const exa = new Exa(apiKey);

  return tool({
    description: 'Search the web',
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const searchResult = await exa.search(query, { numResults: 2 });
      return searchResult.results.map((result: any) => ({
        source: 'web',
        title: result.title,
        url: result.url,
        content: result.text,
      }));
    },
  });
};
