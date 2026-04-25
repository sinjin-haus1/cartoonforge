import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  SocialPublication,
  Platform,
  PublicationStatus,
} from './social.entity';

interface PublishResult {
  success: boolean;
  externalPostId?: string;
  externalUrl?: string;
  errorMessage?: string;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectModel(SocialPublication.name)
    private publicationModel: Model<SocialPublication>,
    private configService: ConfigService,
  ) {}

  async createPublication(userId: string, adId: string, platform: Platform): Promise<SocialPublication> {
    const publication = new this.publicationModel({
      userId,
      adId,
      platform,
      status: PublicationStatus.PENDING,
    });
    return publication.save();
  }

  async findAll(userId?: string): Promise<SocialPublication[]> {
    const filter = userId ? { userId } : {};
    return this.publicationModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<SocialPublication> {
    const pub = await this.publicationModel.findById(id).exec();
    if (!pub) {
      throw new NotFoundException(`Publication with ID ${id} not found`);
    }
    return pub;
  }

  async getPublicationsByAd(adId: string): Promise<SocialPublication[]> {
    return this.publicationModel.find({ adId }).sort({ createdAt: -1 }).exec();
  }

  async getPublicationStatus(id: string): Promise<SocialPublication> {
    return this.findOne(id);
  }

  async getPublishedVideos(userId: string, platform?: Platform): Promise<SocialPublication[]> {
    const filter: Record<string, string> = {
      userId,
      status: PublicationStatus.PUBLISHED,
    };
    if (platform) {
      filter.platform = platform;
    }
    return this.publicationModel.find(filter).sort({ updatedAt: -1 }).exec();
  }

  async publishToTikTok(
    userId: string,
    adId: string,
    videoUrl: string,
    caption: string,
  ): Promise<PublishResult> {
    const publication = await this.createPublication(userId, adId, Platform.TIKTOK);

    try {
      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHING);

      const accessToken = this.configService.get<string>('TIKTOK_ACCESS_TOKEN');
      const advertiserId = this.configService.get<string>('TIKTOK_ADVERTISER_ID');

      if (!accessToken || !advertiserId) {
        throw new Error('TikTok API credentials not configured');
      }

      // TikTok Marketing API - Video Upload
      // Docs: https://business-api.tiktok.com/portal/docs
      const tiktokResponse = await fetch(
        'https://business-api.tiktok.com/portal/api/v2/video/upload',
        {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            advertiser_id: advertiserId,
            video_url: videoUrl,
            title: caption.substring(0, 100),
            description: caption,
          }),
        },
      );

      if (!tiktokResponse.ok) {
        const errorBody = await tiktokResponse.text();
        throw new Error(`TikTok API error: ${tiktokResponse.status} - ${errorBody}`);
      }

      const result = await tiktokResponse.json() as { video_id?: string; share_url?: string };

      const externalPostId = result.video_id || `tiktok_${Date.now()}`;
      const externalUrl = result.share_url || `https://www.tiktok.com/@user/video/${externalPostId}`;

      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHED, {
        externalPostId,
        externalUrl,
      });

      return { success: true, externalPostId, externalUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to publish to TikTok: ${message}`, error);
      await this.updateStatus(publication._id.toString(), PublicationStatus.FAILED, {
        errorMessage: message,
      });
      return { success: false, errorMessage: message };
    }
  }

  async publishToInstagram(
    userId: string,
    adId: string,
    imageUrl: string,
    caption: string,
  ): Promise<PublishResult> {
    const publication = await this.createPublication(userId, adId, Platform.INSTAGRAM);

    try {
      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHING);

      const accessToken = this.configService.get<string>('META_ACCESS_TOKEN');
      const instagramAccountId = this.configService.get<string>('META_INSTAGRAM_ACCOUNT_ID');

      if (!accessToken || !instagramAccountId) {
        throw new Error('Meta API credentials not configured');
      }

      // Meta Graph API - Create Instagram Media Container
      // Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
      const createContainerRes = await fetch(
        `https://graph.facebook.com/v19.0/${instagramAccountId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            image_url: imageUrl,
            caption,
          }),
        },
      );

      if (!createContainerRes.ok) {
        const errorBody = await createContainerRes.text();
        throw new Error(`Meta API container error: ${createContainerRes.status} - ${errorBody}`);
      }

      const container = await createContainerRes.json() as { id?: string };

      if (!container.id) {
        throw new Error('No container ID returned from Meta API');
      }

      // Publish the container
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${instagramAccountId}/media_publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            creation_id: container.id,
          }),
        },
      );

      if (!publishRes.ok) {
        const errorBody = await publishRes.text();
        throw new Error(`Meta API publish error: ${publishRes.status} - ${errorBody}`);
      }

      const published = await publishRes.json() as { id?: string };
      const externalPostId = published.id || container.id;
      const externalUrl = `https://www.instagram.com/p/${externalPostId}`;

      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHED, {
        externalPostId,
        externalUrl,
      });

      return { success: true, externalPostId, externalUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to publish to Instagram: ${message}`, error);
      await this.updateStatus(publication._id.toString(), PublicationStatus.FAILED, {
        errorMessage: message,
      });
      return { success: false, errorMessage: message };
    }
  }

  async publishToYouTube(
    userId: string,
    adId: string,
    videoUrl: string,
    title: string,
    description: string,
  ): Promise<PublishResult> {
    const publication = await this.createPublication(userId, adId, Platform.YOUTUBE);

    try {
      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHING);

      const accessToken = this.configService.get<string>('YOUTUBE_ACCESS_TOKEN');

      if (!accessToken) {
        throw new Error('YouTube API credentials not configured');
      }

      // YouTube Data API v3 - Videos Insert
      // Docs: https://developers.google.com/youtube/v3/docs/videos/insert
      const videoRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            snippet: {
              title: title.substring(0, 100),
              description,
              tags: ['cartoon', 'advertisement', 'smallbusiness'],
              categoryId: '22', // People & Blogs
            },
            status: {
              privacyStatus: 'public',
              selfDeclaredMadeForKids: false,
            },
          }),
        },
      );

      if (!videoRes.ok) {
        const errorBody = await videoRes.text();
        throw new Error(`YouTube API error: ${videoRes.status} - ${errorBody}`);
      }

      const video = await videoRes.json() as { id?: string; snippet?: { channelId?: string } };
      const externalPostId = video.id || `youtube_${Date.now()}`;
      const externalUrl = `https://www.youtube.com/video/${externalPostId}`;

      await this.updateStatus(publication._id.toString(), PublicationStatus.PUBLISHED, {
        externalPostId,
        externalUrl,
      });

      return { success: true, externalPostId, externalUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to publish to YouTube: ${message}`, error);
      await this.updateStatus(publication._id.toString(), PublicationStatus.FAILED, {
        errorMessage: message,
      });
      return { success: false, errorMessage: message };
    }
  }

  private async updateStatus(
    id: string,
    status: PublicationStatus,
    extra: { externalPostId?: string; externalUrl?: string; errorMessage?: string } = {},
  ): Promise<void> {
    await this.publicationModel.findByIdAndUpdate(id, { status, ...extra }).exec();
  }
}
