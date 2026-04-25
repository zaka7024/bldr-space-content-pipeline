// ── Instagram ────────────────────────────────────────────────────

export interface InstagramRelatedProfile {
  id:            string;
  username:      string;
  fullName:      string;
  isPrivate:     boolean;
  isVerified:    boolean;
  profilePicUrl: string;
}

export interface InstagramChildPost {
  id:               string;
  type:             'Image' | 'Video';
  shortCode:        string;
  displayUrl:       string;
  videoUrl:         string | null;
  dimensionsHeight: number;
  dimensionsWidth:  number;
}

export interface InstagramPost {
  id:               string;
  type:             'Image' | 'Video' | 'Sidecar';
  shortCode:        string;
  caption:          string | null;
  hashtags:         string[];
  mentions:         string[];
  url:              string;
  commentsCount:    number;
  dimensionsHeight: number;
  dimensionsWidth:  number;
  displayUrl:       string;
  images:           string[];
  videoUrl:         string | null;
  audioUrl:         string | null;
  alt:              string | null;
  likesCount:       number;
  videoViewCount:   number | null;
  timestamp:        string;
  childPosts:       InstagramChildPost[];
  locationName:     string | null;
  locationId:       string | null;
  ownerUsername:    string;
  ownerId:          string;
}

export interface InstagramRawProfile {
  id:                   string;
  username:             string;
  fullName:             string;
  biography:            string;
  url:                  string;
  externalUrl:          string | null;
  externalUrlShimmed:   string | null;
  followersCount:       number;
  followsCount:         number;
  hasChannel:           boolean;
  highlightReelCount:   number;
  isBusinessAccount:    boolean;
  joinedRecently:       boolean;
  businessCategoryName: string | null;
  private:              boolean;
  verified:             boolean;
  profilePicUrl:        string;
  profilePicUrlHD:      string;
  igtvVideoCount:       number;
  relatedProfiles:      InstagramRelatedProfile[];
  postsCount:           number;
  latestIgtvVideos:     InstagramPost[];
  posts:                InstagramPost[];
  taggedPosts:          InstagramPost[];
}

export interface MediaRef {
  url:         string;
  postUrl:     string;
  postId:      string;
  postType:    string;
  childId?:    string;
  childIndex?: number;
}

export interface VideoRef extends MediaRef {
  audioUrl?:     string;
  thumbnailUrl?: string;
}

export interface InstagramAggregatedResult {
  status:          'success';
  profileMetadata: {
    profileUrl:      string;
    profileType:     'Instagram';
    profileUserId:   string;
    profileUserName: string;
    profilePageName: string;
    profilePicUrl:   string | null;
  };
  postsCount: number;
  postsData:  Record<string, {
    profileType:   'instagram';
    profilePicUrl: string | null;
    images:        MediaRef[];
    videos:        VideoRef[];
    posts:         Record<string, InstagramPost>;
    profileData:   InstagramRawProfile;
  }>;
  images: MediaRef[];
  videos: VideoRef[];
}

// ── Facebook ─────────────────────────────────────────────────────

export interface FacebookPhotoMedia {
  __typename:   'Photo';
  photo_image?: { uri: string };
  image?:       { uri: string };
}

export interface FacebookVideoMedia {
  __typename:                 'Video';
  videoDeliveryLegacyFields?: { browser_native_hd_url?: string };
  videoDeliveryFields?:       { browser_native_sd_url?: string };
}

export type FacebookMediaItem = FacebookPhotoMedia | FacebookVideoMedia;

export interface FacebookRawPost {
  postId:             string;
  url:                string;
  facebookUrl:        string;
  time:               string;
  timestamp:          number;
  text:               string | null;
  likes:              number;
  shares:             number;
  comments:           number;
  topReactionsCount:  number;
  reactionCareCount:  number;
  reactionLoveCount:  number;
  reactionLikeCount:  number;
  viewsCount:         number | null;
  isVideo:            boolean;
  pageName:           string;
  media:              FacebookMediaItem[];
  user: {
    id:         string;
    name:       string;
    profilePic: string;
  };
}

export interface FacebookImageRef {
  url:              string;
  referencePostUrl: string;
  mediaType:        'facebook_image';
  timestamp:        number;
}

export interface FacebookVideoRef {
  url:              string;
  referencePostUrl: string;
  mediaType:        'facebook_video';
  viewsCount:       number | null;
}

export interface FacebookPostData {
  postId:                  string;
  sharedAt:                string;
  timestamp:               number;
  postText:                string | null;
  postLikes:               number;
  postShares:              number;
  postTopReactionsCount:   number;
  postReactionCareCount:   number;
  postReactionLoveCount:   number;
  postReactionLikeCount:   number;
  postComments:            number;
  isVideo:                 boolean;
}

export interface FacebookProfileMetadata {
  profileUrl:      string;
  profileType:     'Facebook';
  profileUserId:   string;
  profilePageName: string;
  profileUserName: string;
  profilePicUrl:   string;
}

export interface FacebookScraperResult {
  status:          'success';
  profileMetadata: FacebookProfileMetadata | null;
  postsCount:      number;
  postsData:       Record<string, FacebookPostData>;
  images:          FacebookImageRef[];
  videos:          FacebookVideoRef[];
}
