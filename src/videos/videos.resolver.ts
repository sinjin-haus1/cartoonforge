import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ObjectType,
  Field,
  Int,
  Float,
  registerEnumType,
  createUnionType,
} from '@nestjs/graphql';
import { Video, VideoStatus, AnimationStyle, TargetPlatform } from './video.entity';
import { VideosService } from './videos.service';

@Resolver(() => Video)
export class VideosResolver {
  constructor(private readonly videosService: VideosService) {}

  // ============ Queries ============

  @Query(() => [Video])
  async videos(
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<Video[]> {
    return this.videosService.findAll(userId);
  }

  @Query(() => [Video])
  async videosByAd(@Args('adId') adId: string): Promise<Video[]> {
    return this.videosService.findByAd(adId);
  }

  @Query(() => Video)
  async video(@Args('id', { type: () => ID }) id: string): Promise<Video> {
    return this.videosService.findOne(id);
  }

  @Query(() => VideoStats)
  async videoStats(@Args('userId') userId: string): Promise<{
    total: number;
    pending: number;
    ready: number;
    published: number;
    failed: number;
  }> {
    return this.videosService.getStats(userId);
  }

  // ============ Mutations ============

  /**
   * Create a new video record (without generating the actual video file)
   */
  @Mutation(() => Video)
  async createVideo(
    @Args('input') input: CreateVideoInput,
  ): Promise<Video> {
    return this.videosService.create({
      adId: input.adId,
      userId: input.userId,
      targetPlatform: input.targetPlatform,
      animationStyle: input.animationStyle,
      durationSeconds: input.durationSeconds,
      loopCount: input.loopCount,
      audioUrl: input.audioUrl,
      caption: input.caption,
      hashtags: input.hashtags,
    });
  }

  /**
   * Generate a video clip from an ad's cartoon image using Cloudinary
   * This is the main video generation mutation
   */
  @Mutation(() => Video)
  async generateVideoClip(
    @Args('input') input: GenerateVideoClipInput,
  ): Promise<Video> {
    return this.videosService.generateVideoClip({
      adId: input.adId,
      userId: input.userId,
      targetPlatform: input.targetPlatform,
      animationStyle: input.animationStyle,
      durationSeconds: input.durationSeconds,
      loopCount: input.loopCount,
      audioUrl: input.audioUrl,
      caption: input.caption,
      hashtags: input.hashtags,
    });
  }

  /**
   * Upload a local video file to Cloudinary
   */
  @Mutation(() => Video)
  async uploadVideo(
    @Args('id', { type: () => ID }) id: string,
    @Args('filePath') filePath: string,
  ): Promise<Video> {
    return this.videosService.uploadVideo(id, filePath);
  }

  /**
   * Publish a ready video to the target social platform
   */
  @Mutation(() => PublishResult)
  async publishVideo(
    @Args('id', { type: () => ID }) id: string,
    @Args('accessToken') accessToken: string,
  ): Promise<{ success: boolean; publishedId: string; platformUrl: string; errorMessage?: string }> {
    return this.videosService.publishToPlatform(id, accessToken);
  }

  /**
   * Delete a video
   */
  @Mutation(() => Boolean)
  async deleteVideo(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.videosService.remove(id);
  }

  /**
   * Get video status (poll for processing status)
   */
  @Mutation(() => Video)
  async refreshVideoStatus(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Video> {
    return this.videosService.findOne(id);
  }
}

// ============ Input Types ============

@ObjectType()
export class CreateVideoInput {
  @Field(() => ID)
  adId: string;

  @Field()
  userId: string;

  @Field(() => TargetPlatform)
  targetPlatform: TargetPlatform;

  @Field(() => AnimationStyle, { nullable: true })
  animationStyle?: AnimationStyle;

  @Field(() => Int, { nullable: true })
  durationSeconds?: number;

  @Field(() => Int, { nullable: true })
  loopCount?: number;

  @Field({ nullable: true })
  audioUrl?: string;

  @Field({ nullable: true })
  caption?: string;

  @Field({ nullable: true })
  hashtags?: string;
}

@ObjectType()
export class GenerateVideoClipInput {
  @Field(() => ID)
  adId: string;

  @Field()
  userId: string;

  @Field(() => TargetPlatform)
  targetPlatform: TargetPlatform;

  @Field(() => AnimationStyle, { nullable: true, defaultValue: AnimationStyle.KEN_BURNS })
  animationStyle: AnimationStyle;

  @Field(() => Int, { nullable: true, defaultValue: 5 })
  durationSeconds: number;

  @Field(() => Int, { nullable: true, defaultValue: 3 })
  loopCount: number;

  @Field({ nullable: true })
  audioUrl?: string;

  @Field({ nullable: true })
  caption?: string;

  @Field({ nullable: true })
  hashtags?: string;
}

// ============ Output Types ============

@ObjectType()
export class PublishResult {
  @Field()
  success: boolean;

  @Field()
  publishedId: string;

  @Field()
  platformUrl: string;

  @Field({ nullable: true })
  errorMessage?: string;
}

@ObjectType()
export class VideoStats {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  ready: number;

  @Field(() => Int)
  published: number;

  @Field(() => Int)
  failed: number;
}

// Register enums in GraphQL schema
registerEnumType(TargetPlatform, { name: 'TargetPlatform' });
registerEnumType(AnimationStyle, { name: 'AnimationStyle' });
registerEnumType(VideoStatus, { name: 'VideoStatus' });