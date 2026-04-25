import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Video, VideoStatus } from './video.entity';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectModel(Video.name) private videoModel: Model<Video>,
    private configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async create(data: {
    adId: string;
    userId: string;
    platform: string;
    videoUrl?: string;
  }): Promise<Video> {
    const video = new this.videoModel({
      ...data,
      adId: new Types.ObjectId(data.adId),
      status: VideoStatus.PENDING,
    });
    return video.save();
  }

  async findAll(userId?: string): Promise<Video[]> {
    const filter = userId ? { userId } : {};
    return this.videoModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findByAd(adId: string): Promise<Video[]> {
    return this.videoModel
      .find({ adId: new Types.ObjectId(adId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Video> {
    const video = await this.videoModel.findById(id).exec();
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return video;
  }

  async update(id: string, data: Partial<Video>): Promise<Video> {
    const video = await this.videoModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return video;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.videoModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return true;
  }

  async uploadVideo(video: Video, filePath: string): Promise<Video> {
    await this.update(video._id.toString(), { status: VideoStatus.PROCESSING });

    try {
      const result = await cloudinary.uploader.upload_large(filePath, {
        folder: 'cartoonforge/videos',
        resource_type: 'video',
        transformation: [
          { quality: 'auto', fetch_format: 'mp4' },
        ],
      });

      return this.update(video._id.toString(), {
        status: VideoStatus.READY,
        videoUrl: result.secure_url,
        externalVideoId: result.public_id,
      });
    } catch (error) {
      this.logger.error('Failed to upload video', error);
      await this.update(video._id.toString(), { status: VideoStatus.FAILED });
      throw error;
    }
  }

  async publishToPlatform(
    video: Video,
    accessToken: string,
  ): Promise<{ publishedId: string; platformUrl: string }> {
    await this.update(video._id.toString(), { status: VideoStatus.PROCESSING });

    try {
      const result = await this.dispatchToPlatform(video, accessToken);
      await this.update(video._id.toString(), {
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(),
        externalVideoId: result.publishedId,
      });
      return result;
    } catch (error) {
      this.logger.error('Failed to publish video', error);
      await this.update(video._id.toString(), { status: VideoStatus.FAILED });
      throw error;
    }
  }

  private async dispatchToPlatform(
    video: Video,
    accessToken: string,
  ): Promise<{ publishedId: string; platformUrl: string }> {
    const platformUrls: Record<string, string> = {
      tiktok: 'https://open.tiktokapis.com/v2/video/config/',
      instagram: 'https://graph.instagram.com/me/media',
      youtube: 'https://upload.youtube.com/api/v2/',
    };

    this.logger.log(`Publishing to ${video.platform} with URL: ${platformUrls[video.platform]}`);

    return {
      publishedId: `mock-${Date.now()}`,
      platformUrl: `https://${video.platform}.com/video/mock-${Date.now()}`,
    };
  }

  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    ready: number;
    published: number;
    failed: number;
  }> {
    const videos = await this.videoModel.find({ userId }).exec();
    return {
      total: videos.length,
      pending: videos.filter(v => v.status === VideoStatus.PENDING).length,
      ready: videos.filter(v => v.status === VideoStatus.READY).length,
      published: videos.filter(v => v.status === VideoStatus.PUBLISHED).length,
      failed: videos.filter(v => v.status === VideoStatus.FAILED).length,
    };
  }
}
