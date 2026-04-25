import {
  Resolver,
  Query,
  Mutation,
  Args,
  ArgsType,
  ID,
  ObjectType,
  Field,
} from '@nestjs/graphql';
import { Video, VideoStatus } from './video.entity';
import { VideosService } from './videos.service';

@Resolver(() => Video)
export class VideosResolver {
  constructor(private readonly videosService: VideosService) {}

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
  async videoStats(@Args('userId') userId: string): Promise<VideoStats> {
    return this.videosService.getStats(userId);
  }

  @Mutation(() => Video)
  async createVideo(@Args('input') input: CreateVideoInput): Promise<Video> {
    return this.videosService.create(input);
  }

  @Mutation(() => Video)
  async uploadVideo(
    @Args('id', { type: () => ID }) id: string,
    @Args('filePath') filePath: string,
  ): Promise<Video> {
    const video = await this.videosService.findOne(id);
    return this.videosService.uploadVideo(video, filePath);
  }

  @Mutation(() => PublishResult)
  async publishVideo(
    @Args('id', { type: () => ID }) id: string,
    @Args('accessToken') accessToken: string,
  ): Promise<PublishResult> {
    const video = await this.videosService.findOne(id);
    return this.videosService.publishToPlatform(video, accessToken);
  }

  @Mutation(() => Boolean)
  async deleteVideo(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.videosService.remove(id);
  }
}

@ArgsType()
class CreateVideoInput {
  @Field()
  adId: string;

  @Field()
  userId: string;

  @Field()
  platform: string;

  @Field({ nullable: true })
  videoUrl?: string;
}

@ObjectType()
class PublishResult {
  @Field()
  publishedId: string;

  @Field()
  platformUrl: string;
}

@ObjectType()
class VideoStats {
  @Field()
  total: number;

  @Field()
  pending: number;

  @Field()
  ready: number;

  @Field()
  published: number;

  @Field()
  failed: number;
}
