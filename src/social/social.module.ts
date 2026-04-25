import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialPublication, SocialPublicationSchema } from './social.entity';
import { SocialService } from './social.service';
import { SocialResolver } from './social.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialPublication.name, schema: SocialPublicationSchema },
    ]),
  ],
  providers: [SocialService, SocialResolver],
  exports: [SocialService],
})
export class SocialModule {}
