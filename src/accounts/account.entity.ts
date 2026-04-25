import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';

export enum Platform {
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
}

registerEnumType(Platform, { name: 'Platform' });

@ObjectType()
@Schema({ timestamps: true })
export class Account extends Document {
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
  accessToken: string;

  @Field({ nullable: true })
  @Prop()
  refreshToken?: string;

  @Field({ nullable: true })
  @Prop()
  expiresAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
