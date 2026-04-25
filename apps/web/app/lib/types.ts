export interface User {
  _id:   string;
  name:  string;
  email: string;
}

export interface BrandVoice {
  tone:                   string;
  style:                  string;
  keywords:               string[];
  targetAudience:         string;
  uniqueValueProposition: string;
  contentThemes:          string[];
  writingStyle:           string;
  examplePhrases:         string[];
}

export interface BrandColors {
  primary?:       string;
  secondary?:     string;
  accent?:        string;
  background?:    string;
  textPrimary?:   string;
  textSecondary?: string;
  [key: string]: string | undefined;
}

export interface Brand {
  colorScheme?: 'light' | 'dark';
  logo?:        string | null;
  colors?:      BrandColors;
  fonts?:       Array<{ family: string; [key: string]: unknown }>;
  typography?:  {
    fontFamilies?: { primary?: string; heading?: string; [key: string]: string | undefined };
  };
  images?: {
    logo?:    string | null;
    favicon?: string | null;
    ogImage?: string | null;
    logoAlt?: string;
  };
}

export interface MediaRef {
  url:          string;
  postUrl:      string;
  postId:       string;
  postType:     string;
  thumbnailUrl?: string;
}

export interface BusinessContext {
  _id:           string;
  businessName:  string;
  websiteUrl:    string;
  instagramUrl?: string;
  facebookUrl?:  string;
  websiteContent: { title: string; url: string; content: string }[];
  instagram?: {
    profileMetadata?: {
      profileUrl:      string;
      profileUserName: string;
      profilePageName: string;
      profilePicUrl:   string | null;
    };
    postsData?: Record<string, {
      profilePicUrl: string | null;
      images:        MediaRef[];
      videos:        MediaRef[];
      profileData?:  { biography?: string; followersCount?: number };
    }>;
    images?: MediaRef[];
    videos?: MediaRef[];
  };
  facebook?: {
    profileMetadata?: { profilePageName: string };
    images?: { url: string; referencePostUrl: string }[];
    videos?: { url: string; referencePostUrl: string }[];
  };
  brand?:      Brand;
  brandVoice?: BrandVoice;
  createdAt:   string;
}

export interface ContentIdea {
  date:             string;
  dayOfWeek:        string;
  title:            string;
  description:      string;
  suggestedCaption: string;
  hashtags:         string[];
  contentTheme:     string;
  postType:         'image' | 'carousel';
  platform:         'instagram' | 'facebook' | 'both';
  bestTimeToPost:   string;
  justification:    string;
}

export interface ContentCalendar {
  _id:               string;
  businessContextId: string;
  startDate:         string;
  endDate:           string;
  ideas:             ContentIdea[];
}
