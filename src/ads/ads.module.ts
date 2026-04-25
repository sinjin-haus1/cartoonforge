import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Ad, AdSchema } from './ad.entity';
import { AdsService } from './ads.service';
import { AdsResolver } from './ads.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ad.name, schema: AdSchema }]),
  ],
  providers: [AdsService, AdsResolver],
  exports: [AdsService],
})
export class AdsModule {}
