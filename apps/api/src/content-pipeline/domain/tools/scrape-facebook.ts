import { tool } from 'ai';
import { z } from 'zod';
import { ApifyClient } from 'apify-client';
import axios from 'axios';
import type {
  FacebookRawPost,
  FacebookPhotoMedia,
  FacebookVideoMedia,
  FacebookImageRef,
  FacebookVideoRef,
  FacebookPostData,
  FacebookProfileMetadata,
  FacebookScraperResult,
} from './types.js';

const FACEBOOK_ACTOR_ID = 'KoJrdxJCTtpon81KY';

async function deleteDataset(datasetId: string, apiKey: string): Promise<void> {
  try {
    await axios.delete(`https://api.apify.com/v2/datasets/${datasetId}`, {
      params: { token: apiKey },
    });
  } catch {
    // best-effort cleanup
  }
}

function collectPostMedia(post: FacebookRawPost): { images: FacebookImageRef[]; videos: FacebookVideoRef[] } {
  const images: FacebookImageRef[] = [];
  const videos: FacebookVideoRef[] = [];

  for (const media of post.media ?? []) {
    if (media.__typename === 'Photo') {
      const photo = media as FacebookPhotoMedia;
      const url = photo.photo_image?.uri ?? photo.image?.uri;
      if (url) images.push({ url, referencePostUrl: post.url, mediaType: 'facebook_image', timestamp: post.timestamp });
    }

    if (media.__typename === 'Video') {
      const video = media as FacebookVideoMedia;
      const url = video.videoDeliveryLegacyFields?.browser_native_hd_url ?? video.videoDeliveryFields?.browser_native_sd_url;
      if (url) videos.push({ url, referencePostUrl: post.url, mediaType: 'facebook_video', viewsCount: post.viewsCount });
    }
  }

  return { images, videos };
}

export const scrapeFacebook = tool({
  description:
    'Scrape a Facebook page and its recent posts using Apify. Returns profile metadata, posts with engagement stats, and all media (images and videos) ready for content generation.',
  inputSchema: z.object({
    profileUrl: z
      .string()
      .describe('Full Facebook page URL, e.g. https://www.facebook.com/nike'),
    resultsLimit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .default(10)
      .describe('Maximum number of posts to fetch (default 10, max 200)'),
  }),
  execute: async (input): Promise<FacebookScraperResult> => {
    const { profileUrl, resultsLimit } = input;
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) throw new Error('APIFY_API_KEY environment variable is not set');

    const apify = new ApifyClient({ token: apiKey });

    const run = await apify.actor(FACEBOOK_ACTOR_ID).call({
      startUrls:    [{ url: profileUrl }],
      resultsLimit,
      captionText:  false,
    });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    await deleteDataset(run.defaultDatasetId, apiKey);

    const posts = items as unknown as FacebookRawPost[];

    const postsData: Record<string, FacebookPostData> = {};
    const allImages: FacebookImageRef[] = [];
    const allVideos: FacebookVideoRef[] = [];
    let profileMetadata: FacebookProfileMetadata | null = null;

    for (const post of posts) {
      if (!post.facebookUrl) throw new Error('Profile URL could not be determined from scraped data.');

      if (!profileMetadata) {
        profileMetadata = {
          profileUrl:      post.facebookUrl,
          profileType:     'Facebook',
          profileUserId:   post.user?.id ?? '',
          profilePageName: post.pageName ?? '',
          profileUserName: post.user?.name ?? '',
          profilePicUrl:   post.user?.profilePic ?? '',
        };
      }

      postsData[post.url] = {
        postId:                post.postId,
        sharedAt:              post.time,
        timestamp:             post.timestamp,
        postText:              post.text,
        postLikes:             post.likes,
        postShares:            post.shares,
        postTopReactionsCount: post.topReactionsCount,
        postReactionCareCount: post.reactionCareCount,
        postReactionLoveCount: post.reactionLoveCount,
        postReactionLikeCount: post.reactionLikeCount,
        postComments:          post.comments,
        isVideo:               post.isVideo,
      };

      const media = collectPostMedia(post);
      allImages.push(...media.images);
      allVideos.push(...media.videos);
    }

    return {
      status:   'success',
      profileMetadata,
      postsCount: posts.length,
      postsData,
      images:   allImages,
      videos:   allVideos,
    };
  },
});
