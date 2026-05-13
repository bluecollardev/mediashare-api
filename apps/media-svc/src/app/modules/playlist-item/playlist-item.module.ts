import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PlaylistItemDataService,
  PlaylistItemService,
} from './playlist-item.service';
import { PlaylistItemController } from './playlist-item.controller';
import { PlaylistItem } from './entities/playlist-item.entity';
import { PlaylistItemMapping } from './mappers/automapper.profile';
import { MediaItemModule } from '../media-item/media-item.module';
import {
  MediaItemDataService,
  MediaItemService,
} from '../media-item/media-item.service';
import { MediaItem } from '../media-item/entities/media-item.entity';
import { AdminGuard } from '../admin/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaylistItem, MediaItem]),
    MediaItemModule,
  ],
  controllers: [PlaylistItemController],
  providers: [
    PlaylistItemService,
    PlaylistItemDataService,
    PlaylistItemMapping,
    MediaItemService,
    MediaItemDataService,
    AdminGuard,
  ],
  exports: [PlaylistItemService],
})
export class PlaylistItemModule {}
