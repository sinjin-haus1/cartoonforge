import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommonsService {
  constructor(private configService: ConfigService) {}

  getMongoUri(): string {
    return this.configService.get<string>(
      'MONGODB_URI',
      'mongodb://localhost:27017/cartoonforge',
    );
  }

  getOpenAIApiKey(): string {
    return this.configService.get<string>(
      'OPENAI_API_KEY',
      'sk-replace-with-your-key',
    );
  }

  getCloudinaryConfig() {
    return {
      cloud_name: this.configService.get<string>(
        'CLOUDINARY_CLOUD_NAME',
        'your-cloud-name',
      ),
      api_key: this.configService.get<string>(
        'CLOUDINARY_API_KEY',
        'your-api-key',
      ),
      api_secret: this.configService.get<string>(
        'CLOUDINARY_API_SECRET',
        'your-api-secret',
      ),
    };
  }

  getFrontendUrl(): string {
    return this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }
}
