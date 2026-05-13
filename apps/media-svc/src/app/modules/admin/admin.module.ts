import { Module } from '@nestjs/common';
import { MediaItemModule } from '../media-item/media-item.module';
import { PlaylistItemModule } from '../playlist-item/playlist-item.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [MediaItemModule, PlaylistItemModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
