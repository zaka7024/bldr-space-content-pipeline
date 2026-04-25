import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
import { writeFileSync } from 'fs';
import { scrapeInstagram, scrapeFacebook } from './index.js';

const platform = process.argv[2] as 'instagram' | 'facebook' | undefined;
const profileUrl = process.argv[3];

if (!platform || !profileUrl) {
  console.error('Usage:');
  console.error('  npx tsx src/content-pipeline/domain/tools/test.ts instagram https://www.instagram.com/nike/');
  console.error('  npx tsx src/content-pipeline/domain/tools/test.ts facebook https://www.facebook.com/nike');
  process.exit(1);
}

const fakeOptions = { toolCallId: 'test', messages: [], abortSignal: undefined as any };

async function main() {
  console.log(`\nScraping ${platform}: ${profileUrl}\n`);

  if (platform === 'instagram') {
    const result = await scrapeInstagram.execute!({ profileUrl, resultsLimit: 10 }, fakeOptions);
    console.log('Profile:      ', result.profileMetadata);
    console.log('Posts fetched:', result.postsCount);
    console.log('Images:       ', result.images.length);
    console.log('Videos:       ', result.videos.length);
    writeFileSync('instagram-result.json', JSON.stringify(result, null, 2));
    console.log('\nFull result → instagram-result.json');

  } else {
    const result = await scrapeFacebook.execute!({ profileUrl, resultsLimit: 10 }, fakeOptions);
    console.log('Profile:      ', result.profileMetadata);
    console.log('Posts fetched:', result.postsCount);
    console.log('Images:       ', result.images.length);
    console.log('Videos:       ', result.videos.length);
    writeFileSync('facebook-result.json', JSON.stringify(result, null, 2));
    console.log('\nFull result → facebook-result.json');
  }
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
