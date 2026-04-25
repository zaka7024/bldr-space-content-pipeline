import { tool } from 'ai';
import { z } from 'zod';
import { ApifyClient } from 'apify-client';
import axios from 'axios';
import type {
  InstagramRawProfile,
  InstagramPost,
  InstagramChildPost,
  MediaRef,
  VideoRef,
  InstagramAggregatedResult,
} from './types.js';

const INSTAGRAM_ACTOR_ID = 'shu8hvrXbJbY3Eb9W';

async function deleteDataset(datasetId: string, apiKey: string): Promise<void> {
  try {
    await axios.delete(`https://api.apify.com/v2/datasets/${datasetId}`, {
      params: { token: apiKey },
    });
  } catch {
    // best-effort cleanup
  }
}

function extractUsername(url: string): string {
  const parts = url.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] ?? url;
}

function collectPostMedia(post: InstagramPost): { images: MediaRef[]; videos: VideoRef[] } {
  const images: MediaRef[] = [];
  const videos: VideoRef[] = [];
  const { type, id: postId, url: postUrl, displayUrl, videoUrl, audioUrl, childPosts } = post;

  if (type === 'Image') {
    if (displayUrl) images.push({ url: displayUrl, postUrl, postId, postType: 'Image' });

  } else if (type === 'Video') {
    if (videoUrl) {
      videos.push({ url: videoUrl, postUrl, postId, postType: 'Video', audioUrl: audioUrl ?? undefined, thumbnailUrl: displayUrl ?? undefined });
    }
    if (displayUrl) images.push({ url: displayUrl, postUrl, postId, postType: 'Video_Thumbnail' });

  } else if (type === 'Sidecar') {
    for (const [idx, child] of (childPosts ?? []).entries()) {
      const childId = (child as InstagramChildPost).id ?? `${postId}_${idx}`;
      if (child.type === 'Image' && child.displayUrl) {
        images.push({ url: child.displayUrl, postUrl, postId, postType: 'Sidecar_Image', childId, childIndex: idx });
      } else if (child.type === 'Video') {
        if (child.videoUrl) {
          videos.push({ url: child.videoUrl, postUrl, postId, postType: 'Sidecar_Video', thumbnailUrl: child.displayUrl ?? undefined, childId, childIndex: idx });
        }
        if (child.displayUrl) {
          images.push({ url: child.displayUrl, postUrl, postId, postType: 'Sidecar_Video_Thumbnail', childId, childIndex: idx });
        }
      }
    }
    if (displayUrl) images.push({ url: displayUrl, postUrl, postId, postType: 'Sidecar_Main' });
  }

  return { images, videos };
}

async function scrapeInstagramProfile(apify: ApifyClient, apiKey: string, profileUrl: string) {
  const run = await apify.actor(INSTAGRAM_ACTOR_ID).call({
    directUrls:   [profileUrl],
    resultsType:  'details',
    resultsLimit: 1,
  });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  if (!items.length) throw new Error('No profile data returned from Apify');
  await deleteDataset(run.defaultDatasetId, apiKey);
  return items[0] as unknown as InstagramRawProfile;
}

async function scrapeInstagramPosts(apify: ApifyClient, apiKey: string, profileUrl: string, resultsLimit: number) {
  const run = await apify.actor(INSTAGRAM_ACTOR_ID).call({
    directUrls:   [profileUrl],
    resultsType:  'posts',
    resultsLimit,
  });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  await deleteDataset(run.defaultDatasetId, apiKey);
  return items as unknown as InstagramPost[];
}

export const scrapeInstagram = tool({
  description:
    'Scrape an Instagram profile and its recent posts using Apify. Returns profile metadata, posts, and all media (images and videos) ready for content generation.',
  inputSchema: z.object({
    profileUrl: z
      .string()
      .describe('Full Instagram profile URL, e.g. https://www.instagram.com/nike/'),
    resultsLimit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(10)
      .describe('Maximum number of posts to fetch (default 10, max 200)'),
  }),
  execute: async (input): Promise<InstagramAggregatedResult> => {
    const { profileUrl, resultsLimit } = input;
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) throw new Error('APIFY_API_KEY environment variable is not set');

    const apify = new ApifyClient({ token: apiKey });

    const [profileData, posts] = await Promise.all([
      scrapeInstagramProfile(apify, apiKey, profileUrl),
      scrapeInstagramPosts(apify, apiKey, profileUrl, resultsLimit),
    ]);

    const username    = extractUsername(profileUrl);
    const profilePicUrl = profileData.profilePicUrlHD || profileData.profilePicUrl || null;

    const allImages: MediaRef[] = [];
    const allVideos: VideoRef[] = [];
    const postsDict: Record<string, InstagramPost> = {};

    for (const post of posts) {
      if (post.url) postsDict[post.url] = post;
      const media = collectPostMedia(post);
      allImages.push(...media.images);
      allVideos.push(...media.videos);
    }

    const profileUrl_ = profileData.url ?? profileUrl;

    return {
      status: 'success',
      profileMetadata: {
        profileUrl:      profileUrl_,
        profileType:     'Instagram',
        profileUserId:   profileData.id,
        profileUserName: profileData.fullName,
        profilePageName: username,
        profilePicUrl,
      },
      postsCount: posts.length,
      postsData: {
        [profileUrl_]: {
          profileType:   'instagram',
          profilePicUrl,
          images:        allImages,
          videos:        allVideos,
          posts:         postsDict,
          profileData,
        },
      },
      images: allImages,
      videos: allVideos,
    };
  },
});
