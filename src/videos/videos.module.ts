import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { Video, VideoSchema } from './video.entity';
import { Ad, AdSchema } from '../ads/ad.entity';
import { VideosService } from './videos.service';
import { VideosResolver } from './videos.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: Ad.name, schema: AdSchema },
    ]),
    ConfigModule,
  ],
  providers: [VideosService, VideosResolver],
  exports: [VideosService],
})
export class VideosModule {}