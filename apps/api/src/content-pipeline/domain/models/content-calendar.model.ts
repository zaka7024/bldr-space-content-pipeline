import { Schema, model, Types } from 'mongoose';

const generatedContentSchema = new Schema(
  {
    primaryCaption: { type: String, required: true },
    platformCaptions: {
      instagram: { type: String, required: true },
      facebook:  { type: String, required: true },
    },
    visualDirection:     { type: String, required: true },
    carouselFrameBriefs: { type: [String], default: [] },
    hashtags:            { type: [String], default: [] },
    callToAction:        { type: String, required: true },
    creatorNotes:        { type: String, required: true },
    /** Data URLs: one image (postType image) or one per carousel slide */
    generatedImageDataUrls: { type: [String], default: [] },
    imageModel:         { type: String, default: 'gpt-image-2-2026-04-21' },
    imageSize:         { type: String, default: '1024x1024' },
    generatedAt:         { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const contentIdeaSchema = new Schema(
  {
    date:              { type: String, required: true },
    dayOfWeek:         { type: String, required: true },
    title:             { type: String, required: true },
    description:       { type: String, required: true },
    suggestedCaption:  { type: String, required: true },
    hashtags:          { type: [String], default: [] },
    contentTheme:      { type: String, required: true },
    postType:          { type: String, enum: ['image', 'carousel'], required: true },
    platform:          { type: String, enum: ['instagram', 'facebook', 'both'], required: true },
    bestTimeToPost:    { type: String, required: true },
    justification:     { type: String, required: true },
    generatedContent:  { type: generatedContentSchema, required: false },
  },
  { _id: true },
);

const contentCalendarSchema = new Schema(
  {
    businessContextId: { type: Types.ObjectId, ref: 'BusinessContext', required: true, index: true },
    startDate:         { type: Date, required: true },
    endDate:           { type: Date, required: true },
    ideas:             { type: [contentIdeaSchema], default: [] },
  },
  { timestamps: true },
);

export const ContentCalendarModel = model('ContentCalendar', contentCalendarSchema);
