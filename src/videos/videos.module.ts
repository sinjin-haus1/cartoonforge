import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from './video.entity';
import { VideosService } from './videos.service';
import { VideosResolver } from './videos.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
  ],
  providers: [VideosService, VideosResolver],
  exports: [VideosService],
})
export class VideosModule {}
