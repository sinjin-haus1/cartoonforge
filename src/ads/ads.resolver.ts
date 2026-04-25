import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Ad, AdStyle, AdStatus } from './ad.entity';
import { AdsService } from './ads.service';

@Resolver(() => Ad)
export class AdsResolver {
  constructor(private readonly adsService: AdsService) {}

  @Query(() => [Ad])
  async ads(@Args('userId', { nullable: true }) userId?: string): Promise<Ad[]> {
    return this.adsService.findAll(userId);
  }

  @Query(() => Ad)
  async ad(@Args('id', { type: () => ID }) id: string): Promise<Ad> {
    return this.adsService.findOne(id);
  }

  @Query(() => AdStats)
  async adStats(@Args('userId') userId: string): Promise<AdStats> {
    return this.adsService.getStats(userId);
  }

  @Mutation(() => Ad)
  async createAd(@Args('input') input: CreateAdInput): Promise<Ad> {
    return this.adsService.create(input);
  }

  @Mutation(() => Ad)
  async generateAdImage(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<{ imageUrl: string; publicId: string }> {
    const ad = await this.adsService.findOne(id);
    return this.adsService.generateCartoonImage(ad);
  }

  @Mutation(() => Ad)
  async updateAd(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAdInput,
  ): Promise<Ad> {
    return this.adsService.update(id, input);
  }

  @Mutation(() => Boolean)
  async deleteAd(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.adsService.remove(id);
  }
}

@ArgsType()
class CreateAdInput {
  @Field()
  userId: string;

  @Field()
  productDescription: string;

  @Field(() => AdStyle)
  style: AdStyle;
}

@ArgsType()
class UpdateAdInput {
  @Field({ nullable: true })
  productDescription?: string;

  @Field(() => AdStyle, { nullable: true })
  style?: AdStyle;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field(() => AdStatus, { nullable: true })
  status?: AdStatus;
}

@ObjectType()
class AdStats {
  @Field()
  total: number;

  @Field()
  pending: number;

  @Field()
  ready: number;

  @Field()
  failed: number;
}
