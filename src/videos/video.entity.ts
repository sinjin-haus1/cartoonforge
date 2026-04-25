import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, Float, Int, registerEnumType } from '@nestjs/graphql';

export enum VideoStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

export enum AnimationStyle {
  ZOOM_PAN = 'zoom_pan',
  KEN_BURNS = 'ken_burns',
  PULSE = 'pulse',
  SLIDE = 'slide',
  FADE = 'fade',
}

export enum TargetPlatform {
  TIKTOK = 'tiktok',
  INSTAGRAM_REELS = 'instagram_reels',
  YOUTUBE_SHORTS = 'youtube_shorts',
  SNAPCHAT = 'snapchat',
}

registerEnumType(VideoStatus, { name: 'VideoStatus' });
registerEnumType(AnimationStyle, { name: 'AnimationStyle' });
registerEnumType(TargetPlatform, { name: 'TargetPlatform' });

@ObjectType()
@Schema({ timestamps: true })
export class Video extends Document {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Ad', required: true })
  adId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  userId: string;

  @Field({ nullable: true })
  @Prop()
  videoUrl?: string;

  @Field({ nullable: true })
  @Prop()
  thumbnailUrl?: string;

  @Field(() => TargetPlatform)
  @Prop({ required: true, enum: TargetPlatform })
  targetPlatform: TargetPlatform;

  @Field(() => AnimationStyle)
  @Prop({ required: true, enum: AnimationStyle, default: AnimationStyle.KEN_BURNS })
  animationStyle: AnimationStyle;

  @Field(() => Int)
  @Prop({ required: true, default: 5 })
  durationSeconds: number;

  @Field(() => Float)
  @Prop({ default: 1.0 })
  aspectRatio: number;

  @Field(() => VideoStatus)
  @Prop({ required: true, enum: VideoStatus, default: VideoStatus.PENDING })
  status: VideoStatus;

  @Field({ nullable: true })
  @Prop()
  loopCount?: number;

  @Field({ nullable: true })
  @Prop()
  audioUrl?: string;

  @Field({ nullable: true })
  @Prop()
  caption?: string;

  @Field({ nullable: true })
  @Prop()
  hashtags?: string;

  @Field({ nullable: true })
  @Prop()
  publishedAt?: Date;

  @Field({ nullable: true })
  @Prop()
  externalVideoId?: string;

  @Field({ nullable: true })
  @Prop()
  externalPlatformUrl?: string;

  @Field({ nullable: true })
  @Prop()
  cloudinaryPublicId?: string;

  @Field({ nullable: true })
  @Prop()
  cloudinaryVideoUrl?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);