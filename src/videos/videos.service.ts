import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Video, VideoStatus, AnimationStyle, TargetPlatform } from './video.entity';
import { Ad, AdStatus } from '../ads/ad.entity';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerateVideoClipInput {
  adId: string;
  userId: string;
  targetPlatform: TargetPlatform;
  animationStyle?: AnimationStyle;
  durationSeconds?: number;
  loopCount?: number;
  audioUrl?: string;
  caption?: string;
  hashtags?: string;
}

export interface PublishResult {
  success: boolean;
  publishedId: string;
  platformUrl: string;
  errorMessage?: string;
}

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  // Platform-specific video settings
  private readonly platformSettings: Record<TargetPlatform, {
    aspectRatio: number;
    maxDuration: number;
    recommendedFormats: string[];
  }> = {
    [TargetPlatform.TIKTOK]: {
      aspectRatio: 9 / 16,
      maxDuration: 60,
      recommendedFormats: ['mp4', 'webm'],
    },
    [TargetPlatform.INSTAGRAM_REELS]: {
      aspectRatio: 9 / 16,
      maxDuration: 90,
      recommendedFormats: ['mp4'],
    },
    [TargetPlatform.YOUTUBE_SHORTS]: {
      aspectRatio: 9 / 16,
      maxDuration: 60,
      recommendedFormats: ['mp4'],
    },
    [TargetPlatform.SNAPCHAT]: {
      aspectRatio: 9 / 16,
      maxDuration: 60,
      recommendedFormats: ['mp4', 'h264'],
    },
  };

  constructor(
    @InjectModel(Video.name) private videoModel: Model<Video>,
    @InjectModel(Ad.name) private adModel: Model<Ad>,
    private configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Create a new video record from an ad
   */
  async create(data: {
    adId: string;
    userId: string;
    targetPlatform: TargetPlatform;
    animationStyle?: AnimationStyle;
    durationSeconds?: number;
    videoUrl?: string;
    thumbnailUrl?: string;
    loopCount?: number;
    audioUrl?: string;
    caption?: string;
    hashtags?: string;
  }): Promise<Video> {
    const platformSettings = this.platformSettings[data.targetPlatform];
    
    const video = new this.videoModel({
      ...data,
      adId: new Types.ObjectId(data.adId),
      status: VideoStatus.PENDING,
      aspectRatio: platformSettings.aspectRatio,
      durationSeconds: data.durationSeconds || 5,
      loopCount: data.loopCount || 3,
    });
    return video.save();
  }

  /**
   * Generate a video clip from an ad's cartoon image using Cloudinary transformations
   */
  async generateVideoClip(input: GenerateVideoClipInput): Promise<Video> {
    const { adId, userId, targetPlatform, animationStyle, durationSeconds, loopCount, audioUrl, caption, hashtags } = input;

    // Find the ad and verify it exists and has an image
    const ad = await this.adModel.findById(adId).exec();
    if (!ad) {
      throw new NotFoundException(`Ad with ID ${adId} not found`);
    }

    if (!ad.imageUrl) {
      throw new NotFoundException(`Ad ${adId} has no image URL to generate video from`);
    }

    // Create a video record first
    const videoData = {
      adId,
      userId,
      targetPlatform,
      animationStyle: animationStyle || AnimationStyle.KEN_BURNS,
      durationSeconds: durationSeconds || 5,
      loopCount: loopCount || 3,
      audioUrl,
      caption,
      hashtags,
    };

    const video = await this.create(videoData);
    const videoId = video._id.toString();

    try {
      // Update status to processing
      await this.updateStatus(videoId, VideoStatus.PROCESSING);

      // Generate video URL using Cloudinary video transformation
      const cloudinaryUrl = await this.createAnimatedVideoUrl(
        ad.imageUrl,
        ad.cloudinaryPublicId,
        {
          animationStyle: animationStyle || AnimationStyle.KEN_BURNS,
          durationSeconds: durationSeconds || 5,
          loopCount: loopCount || 3,
          aspectRatio: this.platformSettings[targetPlatform].aspectRatio,
          targetPlatform,
        }
      );

      // Upload to Cloudinary as a video resource
      const uploadedVideo = await this.uploadGeneratedVideo(cloudinaryUrl, videoId);

      // Update video with results
      return await this.update(videoId, {
        status: VideoStatus.READY,
        videoUrl: uploadedVideo.secure_url,
        cloudinaryPublicId: uploadedVideo.public_id,
        cloudinaryVideoUrl: uploadedVideo.secure_url,
        thumbnailUrl: this.generateThumbnailUrl(uploadedVideo.public_id),
      });
    } catch (error) {
      this.logger.error(`Failed to generate video clip for video ${videoId}`, error);
      await this.updateStatus(videoId, VideoStatus.FAILED);
      throw error;
    }
  }

  /**
   * Create an animated video URL from a cartoon image using Cloudinary transformations
   */
  private async createAnimatedVideoUrl(
    imageUrl: string,
    cloudinaryPublicId: string | undefined,
    options: {
      animationStyle: AnimationStyle;
      durationSeconds: number;
      loopCount: number;
      aspectRatio: number;
      targetPlatform: TargetPlatform;
    }
  ): Promise<string> {
    const { animationStyle, durationSeconds, loopCount, aspectRatio, targetPlatform } = options;

    // Calculate zoom and pan parameters based on animation style
    const animationParams = this.getAnimationParameters(animationStyle, aspectRatio);

    // If we have a Cloudinary public ID for the source image, use Cloudinary transformations
    if (cloudinaryPublicId) {
      // Generate video using Cloudinary's video generation from image
      // Cloudinary can create video transformations from image uploads
      const transformationString = this.buildTransformationString({
        ...animationParams,
        duration: durationSeconds,
        loop: loopCount,
        fps: 30,
        videoCodec: 'svq_h264', // High quality H.264
        audioCodec: 'none',
      });

      // Use Cloudinary's video generation API to create animated video
      const videoConfig = {
        public_id: cloudinaryPublicId,
        resource_type: 'image' as const, // Uploaded as image but will be used to generate video
        transformation: transformationString,
        notification_url: undefined,
      };

      // For Cloudinary to generate video from image, we upload with video transformation
      // The image will be processed to create a looping video effect
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: 'cartoonforge/videos/source',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:best' },
          { fetch_format: 'png' },
        ],
      } as any);

      // Create animated video from the uploaded image
      const animatedResult = await cloudinary.uploader.upload(imageUrl, {
        folder: `cartoonforge/videos/generated/${Date.now()}`,
        resource_type: 'video',
        file: imageUrl,
        transformation: [
          // Apply animation transformation
          ...this.getAnimationTransformation(animationStyle),
          // Video settings
          { duration: durationSeconds.toString() },
          { loop: loopCount.toString() },
          // Output settings
          { quality: 'auto' },
          { fetch_format: 'mp4' },
        ],
      } as any);

      return animatedResult.secure_url;
    }

    // For external URLs, fetch and upload to Cloudinary first, then transform
    // Download the image
    const tempImagePath = `/tmp/cartoon_image_${Date.now()}.png`;
    
    try {
      // Fetch and save the image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      fs.writeFileSync(tempImagePath, Buffer.from(imageBuffer));

      // Upload to Cloudinary
      const uploaded = await cloudinary.uploader.upload(tempImagePath, {
        folder: 'cartoonforge/videos/source',
        resource_type: 'image',
      });

      // Generate animated video from the uploaded image
      const animatedResult = await cloudinary.uploader.upload(tempImagePath, {
        folder: `cartoonforge/videos/generated/${Date.now()}`,
        resource_type: 'video',
        file: tempImagePath,
        transformation: [
          ...this.getAnimationTransformation(animationStyle),
          { duration: durationSeconds.toString() },
          { loop: loopCount.toString() },
          { quality: 'auto' },
          { fetch_format: 'mp4' },
        ],
      } as any);

      return animatedResult.secure_url;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
    }
  }

  /**
   * Get Cloudinary transformation parameters for animation style
   */
  private getAnimationParameters(animationStyle: AnimationStyle, aspectRatio: number): Record<string, any> {
    const baseParams: Record<string, any> = {
      // Common settings
      quality: 'auto',
      fetch_format: 'mp4',
      video_codec: 'svq_h264',
    };

    switch (animationStyle) {
      case AnimationStyle.ZOOM_PAN:
        return {
          ...baseParams,
          zoom: '1.2',
          x: 100,
          y: 50,
          transition: true,
        };

      case AnimationStyle.KEN_BURNS:
        // Ken Burns effect: slow zoom and pan
        return {
          ...baseParams,
          zoom: '1.15',
          pan: 'true',
          zoompan: '12', // 12 second animation cycle
        };

      case AnimationStyle.PULSE:
        return {
          ...baseParams,
          zoom: '1.1',
          effect: 'volume:20', // Can add pulse effect
        };

      case AnimationStyle.SLIDE:
        return {
          ...baseParams,
          x: 100,
          transition: 'slide',
        };

      case AnimationStyle.FADE:
        return {
          ...baseParams,
          overlay: 'none',
          transition: 'fade',
        };

      default:
        return baseParams;
    }
  }

  /**
   * Get Cloudinary transformation array for animation
   */
  private getAnimationTransformation(animationStyle: AnimationStyle): any[] {
    switch (animationStyle) {
      case AnimationStyle.ZOOM_PAN:
        return [
          { overlay: 'video:ken_burns_zoom' },
          { flags: 'layer_apply' },
        ];

      case AnimationStyle.KEN_BURNS:
        // Simulate Ken Burns with zoom and pan
        return [
          { quality: 'auto:best' },
          { effect: 'zoompan:12' }, // 12 second zoompan effect
        ];

      case AnimationStyle.PULSE:
        return [
          { quality: 'auto' },
          { effect: 'loop:3' }, // Simple loop
        ];

      case AnimationStyle.SLIDE:
        return [
          { quality: 'auto' },
          { effect: 'slide:3' },
        ];

      case AnimationStyle.FADE:
        return [
          { quality: 'auto' },
          { effect: 'fade:2000' }, // 2 second fade
        ];

      default:
        return [{ quality: 'auto' }];
    }
  }

  /**
   * Build Cloudinary transformation string
   */
  private buildTransformationString(params: Record<string, any>): string {
    const parts: string[] = [];

    if (params.duration) parts.push(`du_${params.duration}`);
    if (params.loop !== undefined) parts.push(`l_${params.loop},so_${params.loop}`);
    if (params.fps) parts.push(`fps_${params.fps}`);
    if (params.videoCodec) parts.push(`vc_${params.videoCodec}`);
    if (params.zoom) parts.push(`z_${params.zoom}`);
    if (params.x) parts.push(`x_${params.x}`);
    if (params.y) parts.push(`y_${params.y}`);
    if (params.transition) parts.push(`e_transition`);

    return parts.join('/');
  }

  /**
   * Upload a generated video URL to Cloudinary
   */
  private async uploadGeneratedVideo(videoUrl: string, videoId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.upload(videoUrl, {
        folder: `cartoonforge/videos/output`,
        resource_type: 'video',
        public_id: `video_${videoId}`,
        transformation: [
          { quality: 'auto:best' },
          { fetch_format: 'mp4' },
          { duration: 15 }, // Max 15 seconds for social
        ],
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to upload generated video to Cloudinary: ${videoUrl}`, error);
      // If Cloudinary upload fails, return the original URL
      return { secure_url: videoUrl, public_id: `external_${videoId}` };
    }
  }

  /**
   * Generate thumbnail URL from Cloudinary video public ID
   */
  private generateThumbnailUrl(publicId: string): string {
    if (!publicId || publicId.startsWith('external_')) {
      return '';
    }
    
    return cloudinary.url(publicId, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { start_offset: 0 },
        { width: 400 },
        { height: 400 },
        { crop: 'thumb' },
        { quality: 'auto' },
      ],
    });
  }

  /**
   * Upload a local video file
   */
  async uploadVideo(videoId: string, filePath: string): Promise<Video> {
    await this.updateStatus(videoId, VideoStatus.PROCESSING);

    try {
      const result = await cloudinary.uploader.upload_large(filePath, {
        folder: 'cartoonforge/videos',
        resource_type: 'video',
        public_id: `video_${videoId}`,
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'mp4' },
        ],
      }) as any;

      const secureUrl = typeof result === 'string' ? result : result.secure_url;
      const publicId = typeof result === 'string' ? `video_${videoId}` : result.public_id;

      return await this.update(videoId, {
        status: VideoStatus.READY,
        videoUrl: secureUrl,
        cloudinaryPublicId: publicId,
        cloudinaryVideoUrl: secureUrl,
        thumbnailUrl: this.generateThumbnailUrl(publicId),
      });
    } catch (error) {
      this.logger.error(`Failed to upload video ${videoId}`, error);
      await this.updateStatus(videoId, VideoStatus.FAILED);
      throw error;
    }
  }

  /**
   * Publish video to target social platform
   */
  async publishToPlatform(videoId: string, accessToken: string): Promise<PublishResult> {
    const video = await this.findOne(videoId);
    
    if (video.status !== VideoStatus.READY) {
      throw new Error(`Video must be in READY status to publish. Current status: ${video.status}`);
    }

    await this.updateStatus(videoId, VideoStatus.PROCESSING);

    try {
      const result = await this.dispatchToPlatform(video, accessToken);
      
      await this.update(videoId, {
        status: VideoStatus.PUBLISHED,
        publishedAt: new Date(),
        externalVideoId: result.publishedId,
        externalPlatformUrl: result.platformUrl,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to publish video ${videoId}`, error);
      await this.updateStatus(videoId, VideoStatus.FAILED);
      throw error;
    }
  }

  /**
   * Dispatch video to the appropriate platform API
   */
  private async dispatchToPlatform(video: Video, accessToken: string): Promise<PublishResult> {
    const platformConfig = this.getPlatformConfig(video.targetPlatform);

    this.logger.log(`Publishing to ${video.targetPlatform} via ${platformConfig.apiEndpoint}`);

    // Build the video metadata
    const metadata = {
      videoUrl: video.videoUrl,
      caption: video.caption || this.generateDefaultCaption(video),
      hashtags: video.hashtags || this.generateDefaultHashtags(video),
      thumbnailUrl: video.thumbnailUrl,
      duration: video.durationSeconds,
    };

    // Make the API call to the platform
    const response = await fetch(platformConfig.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...platformConfig.headers,
      },
      body: JSON.stringify({
        video_url: metadata.videoUrl,
        caption: metadata.caption,
        hashtags: metadata.hashtags,
        thumbnail_url: metadata.thumbnailUrl,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Platform API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      publishedId: result.id || result.video_id || `cf_${Date.now()}`,
      platformUrl: result.permalink || result.url || platformConfig.getPermalink(result.id),
    };
  }

  /**
   * Get platform-specific configuration
   */
  private getPlatformConfig(platform: TargetPlatform): {
    apiEndpoint: string;
    headers: Record<string, string>;
    getPermalink: (id: string) => string;
  } {
    const configs: Record<TargetPlatform, any> = {
      [TargetPlatform.TIKTOK]: {
        apiEndpoint: 'https://open.tiktokapis.com/v2/video/config/',
        headers: {
          'Content-Type': 'application/json',
        },
        getPermalink: (id: string) => `https://www.tiktok.com/@user/video/${id}`,
      },
      [TargetPlatform.INSTAGRAM_REELS]: {
        apiEndpoint: 'https://graph.instagram.com/me/media',
        headers: {
          'Content-Type': 'application/json',
        },
        getPermalink: (id: string) => `https://www.instagram.com/reel/${id}`,
      },
      [TargetPlatform.YOUTUBE_SHORTS]: {
        apiEndpoint: 'https://upload.googleapis.com/upload/api/v2/video',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        getPermalink: (id: string) => `https://youtube.com/shorts/${id}`,
      },
      [TargetPlatform.SNAPCHAT]: {
        apiEndpoint: 'https://api.snapchat.com/v2/video',
        headers: {
          'Content-Type': 'application/json',
        },
        getPermalink: (id: string) => `https://snapchat.com/video/${id}`,
      },
    };

    return configs[platform];
  }

  /**
   * Generate default caption for video
   */
  private generateDefaultCaption(video: Video): string {
    const platformEmoji: Record<TargetPlatform, string> = {
      [TargetPlatform.TIKTOK]: '🎬',
      [TargetPlatform.INSTAGRAM_REELS]: '📸',
      [TargetPlatform.YOUTUBE_SHORTS]: '▶️',
      [TargetPlatform.SNAPCHAT]: '👻',
    };

    return `Check out this cartoon ad! ${platformEmoji[video.targetPlatform]}`;
  }

  /**
   * Generate default hashtags
   */
  private generateDefaultHashtags(video: Video): string {
    const hashtags: Record<TargetPlatform, string[]> = {
      [TargetPlatform.TIKTOK]: ['cartoon', 'advertisement', 'viral', 'trending', 'cartoonad'],
      [TargetPlatform.INSTAGRAM_REELS]: ['cartoon', 'ad', 'reels', 'creative', 'illustrated'],
      [TargetPlatform.YOUTUBE_SHORTS]: ['shorts', 'cartoon', 'ad', 'youtube', 'viral'],
      [TargetPlatform.SNAPCHAT]: ['snap', 'ad', 'cartoon', 'creative'],
    };

    return hashtags[video.targetPlatform].join(' ');
  }

  // Standard CRUD operations

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

  private async updateStatus(id: string, status: VideoStatus): Promise<Video> {
    return this.update(id, { status });
  }

  async remove(id: string): Promise<boolean> {
    const video = await this.findOne(id);
    
    // Delete from Cloudinary if we have a public ID
    if (video.cloudinaryPublicId && !video.cloudinaryPublicId.startsWith('external_')) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: 'video' });
      } catch (error) {
        this.logger.warn(`Failed to delete video from Cloudinary: ${video.cloudinaryPublicId}`, error);
      }
    }

    const result = await this.videoModel.findByIdAndDelete(id).exec();
    return !!result;
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