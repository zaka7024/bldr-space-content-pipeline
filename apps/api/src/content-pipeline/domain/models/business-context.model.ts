import { Schema, Types, model } from 'mongoose';

const websitePageSchema = new Schema(
  {
    title:   { type: String, default: '' },
    url:     { type: String, required: true },
    content: { type: String, default: '' },
  },
  { _id: false },
);

const brandVoiceSchema = new Schema(
  {
    tone:                   { type: String, required: true },
    style:                  { type: String, required: true },
    keywords:               { type: [String], default: [] },
    targetAudience:         { type: String, required: true },
    uniqueValueProposition: { type: String, required: true },
    contentThemes:          { type: [String], default: [] },
    writingStyle:           { type: String, required: true },
    examplePhrases:         { type: [String], default: [] },
  },
  { _id: false },
);

const businessContextSchema = new Schema(
  {
    userId:         { type: Types.ObjectId, ref: 'User', required: true, index: true },
    businessName:   { type: String, required: true, index: true },
    websiteUrl:     { type: String, required: true },
    instagramUrl:   { type: String },
    facebookUrl:    { type: String },
    websiteContent: { type: [websitePageSchema], default: [] },
    instagram:      { type: Schema.Types.Mixed, default: null },
    facebook:       { type: Schema.Types.Mixed, default: null },
    brand:          { type: Schema.Types.Mixed, default: null },
    brandVoice:     { type: brandVoiceSchema, required: true },
  },
  { timestamps: true },
);

export const BusinessContextModel = model('BusinessContext', businessContextSchema);
