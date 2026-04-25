import { Schema, model, Types } from 'mongoose';

const contentIdeaSchema = new Schema(
  {
    date:             { type: String, required: true },
    dayOfWeek:        { type: String, required: true },
    title:            { type: String, required: true },
    description:      { type: String, required: true },
    suggestedCaption: { type: String, required: true },
    hashtags:         { type: [String], default: [] },
    contentTheme:     { type: String, required: true },
    postType:         { type: String, enum: ['image', 'carousel'], required: true },
    platform:         { type: String, enum: ['instagram', 'facebook', 'both'], required: true },
    bestTimeToPost:   { type: String, required: true },
    justification:    { type: String, required: true },
  },
  { _id: false },
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
