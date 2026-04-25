import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ad, AdStyle, AdStatus } from './ad.entity';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);
  private openai: OpenAI;

  constructor(
    @InjectModel(Ad.name) private adModel: Model<Ad>,
    private configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('OPENAI_API_KEY'),
    });

    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async create(data: { userId: string; productDescription: string; style: AdStyle }): Promise<Ad> {
    const ad = new this.adModel({
      ...data,
      status: AdStatus.PENDING,
    });
    return ad.save();
  }

  async findAll(userId?: string): Promise<Ad[]> {
    const filter = userId ? { userId } : {};
    return this.adModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<Ad> {
    const ad = await this.adModel.findById(id).exec();
    if (!ad) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return ad;
  }

  async update(id: string, data: Partial<Ad>): Promise<Ad> {
    const ad = await this.adModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!ad) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return ad;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.adModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Ad with ID ${id} not found`);
    }
    return true;
  }

  async generateCartoonImage(ad: Ad): Promise<{ imageUrl: string; publicId: string }> {
    await this.update(ad._id.toString(), { status: AdStatus.GENERATING });

    const prompt = await this.buildPrompt(ad);
    await this.update(ad._id.toString(), { cartoonPrompt: prompt });

    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
      });

      const imageUrl = response.data[0].url!;

      const cloudinaryResult = await cloudinary.uploader.upload(imageUrl, {
        folder: 'cartoonforge/ads',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      });

      await this.update(ad._id.toString(), {
        status: AdStatus.READY,
        imageUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
      });

      return {
        imageUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
      };
    } catch (error) {
      this.logger.error('Failed to generate image', error);
      await this.update(ad._id.toString(), { status: AdStatus.FAILED });
      throw error;
    }
  }

  private async buildPrompt(ad: Ad): Promise<string> {
    const styleDescriptions: Record<AdStyle, string> = {
      [AdStyle.CARTOON]: 'fun cartoon style, bright colors, playful character, bold outlines, simple background',
      [AdStyle.ILLUSTRATED]: 'editorial illustration style, detailed, vibrant colors, professional art direction',
      [AdStyle.ANIMATED]: 'animation style, dynamic pose, expressive character, rich color palette, cinematic composition',
    };

    const baseStyle = styleDescriptions[ad.style] || styleDescriptions[AdStyle.CARTOON];

    const systemPrompt = `You are an expert advertising creative specializing in creating compelling cartoon-style ads for small businesses. Create vivid, engaging prompts that will generate effective marketing images.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a detailed image generation prompt for an ad with this description: "${ad.productDescription}". Style: ${baseStyle}. Make it punchy, memorable, and suitable for social media advertising. Return only the prompt, nothing else.`,
        },
      ],
      max_tokens: 200,
    });

    return completion.choices[0].message.content || `A fun cartoon illustration promoting: ${ad.productDescription}, ${baseStyle}`;
  }

  async getStats(userId: string): Promise<{ total: number; pending: number; ready: number; failed: number }> {
    const ads = await this.adModel.find({ userId }).exec();
    return {
      total: ads.length,
      pending: ads.filter(a => a.status === AdStatus.PENDING || a.status === AdStatus.GENERATING).length,
      ready: ads.filter(a => a.status === AdStatus.READY).length,
      failed: ads.filter(a => a.status === AdStatus.FAILED).length,
    };
  }
}
