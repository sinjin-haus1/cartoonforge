import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';

export enum Platform {
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
}

export enum PublicationStatus {
  PENDING = 'pending',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

registerEnumType(Platform, { name: 'Platform' });
registerEnumType(PublicationStatus, { name: 'PublicationStatus' });

@ObjectType()
@Schema({ timestamps: true })
export class SocialPublication extends Document {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  userId: string;

  @Field(() => Platform)
  @Prop({ required: true, enum: Platform })
  platform: Platform;

  @Field()
  @Prop({ required: true })
  adId: string;

  @Field(() => PublicationStatus)
  @Prop({ required: true, enum: PublicationStatus, default: PublicationStatus.PENDING })
  status: PublicationStatus;

  @Field({ nullable: true })
  @Prop()
  externalPostId?: string;

  @Field({ nullable: true })
  @Prop()
  externalUrl?: string;

  @Field({ nullable: true })
  @Prop()
  errorMessage?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const SocialPublicationSchema = SchemaFactory.createForClass(SocialPublication);
