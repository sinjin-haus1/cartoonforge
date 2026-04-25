import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ObjectType,
  Field,
} from '@nestjs/graphql';
import { SocialPublication, Platform } from './social.entity';
import { SocialService } from './social.service';

@Resolver(() => SocialPublication)
export class SocialResolver {
  constructor(private readonly socialService: SocialService) {}

  @Query(() => [SocialPublication])
  async publications(
    @Args('userId', { nullable: true }) userId?: string,
  ): Promise<SocialPublication[]> {
    return this.socialService.findAll(userId);
  }

  @Query(() => SocialPublication)
  async publicationStatus(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SocialPublication> {
    return this.socialService.getPublicationStatus(id);
  }

  @Query(() => [SocialPublication])
  async publishedVideos(
    @Args('userId') userId: string,
    @Args('platform', { type: () => Platform, nullable: true }) platform?: Platform,
  ): Promise<SocialPublication[]> {
    return this.socialService.getPublishedVideos(userId, platform);
  }

  @Query(() => [SocialPublication])
  async adPublications(
    @Args('adId', { type: () => ID }) adId: string,
  ): Promise<SocialPublication[]> {
    return this.socialService.getPublicationsByAd(adId);
  }

  @Mutation(() => PublishResult)
  async publishAdToTikTok(
    @Args('userId') userId: string,
    @Args('adId', { type: () => ID }) adId: string,
    @Args('videoUrl') videoUrl: string,
    @Args('caption') caption: string,
  ): Promise<PublishResult> {
    return this.socialService.publishToTikTok(userId, adId, videoUrl, caption);
  }

  @Mutation(() => PublishResult)
  async publishAdToInstagram(
    @Args('userId') userId: string,
    @Args('adId', { type: () => ID }) adId: string,
    @Args('imageUrl') imageUrl: string,
    @Args('caption') caption: string,
  ): Promise<PublishResult> {
    return this.socialService.publishToInstagram(userId, adId, imageUrl, caption);
  }

  @Mutation(() => PublishResult)
  async publishAdToYouTube(
    @Args('userId') userId: string,
    @Args('adId', { type: () => ID }) adId: string,
    @Args('videoUrl') videoUrl: string,
    @Args('title') title: string,
    @Args('description') description: string,
  ): Promise<PublishResult> {
    return this.socialService.publishToYouTube(userId, adId, videoUrl, title, description);
  }
}

@ObjectType()
export class PublishResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  externalPostId?: string;

  @Field({ nullable: true })
  externalUrl?: string;

  @Field({ nullable: true })
  errorMessage?: string;
}
