import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaItemMapping } from './mappers/automapper.profile';
import { MediaItemDataService, MediaItemService } from './media-item.service';
import { MediaItemController } from './media-item.controller';
import { MediaItem } from './entities/media-item.entity';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([MediaItem])],
  controllers: [MediaItemController],
  providers: [
    MediaItemService,
    MediaItemDataService,
    MediaItemMapping,
    AdminGuard,
  ],
  exports: [MediaItemService],
})
export class MediaItemModule {}
