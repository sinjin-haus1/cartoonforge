import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonsService } from './commons.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CommonsService],
  exports: [CommonsService],
})
export class CommonsModule {}
