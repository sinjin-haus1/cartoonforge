import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';

export enum AdStyle {
  CARTOON = 'cartoon',
  ILLUSTRATED = 'illustrated',
  ANIMATED = 'animated',
}

export enum AdStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  READY = 'ready',
  FAILED = 'failed',
}

registerEnumType(AdStyle, { name: 'AdStyle' });
registerEnumType(AdStatus, { name: 'AdStatus' });

@ObjectType()
@Schema({ timestamps: true })
export class Ad extends Document {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  userId: string;

  @Field()
  @Prop({ required: true })
  productDescription: string;

  @Field(() => AdStyle)
  @Prop({ required: true, enum: AdStyle })
  style: AdStyle;

  @Field({ nullable: true })
  @Prop()
  cartoonPrompt?: string;

  @Field({ nullable: true })
  @Prop()
  imageUrl?: string;

  @Field(() => AdStatus)
  @Prop({ required: true, enum: AdStatus, default: AdStatus.PENDING })
  status: AdStatus;

  @Field({ nullable: true })
  @Prop()
  cloudinaryPublicId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const AdSchema = SchemaFactory.createForClass(Ad);
