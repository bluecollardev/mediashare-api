import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagDataService, TagService } from './tag.service';
import { TagController } from './tag.controller';
import { TagMapping } from './mappers/automapper.profile';
import { Tag } from '@mediashare/core/modules/tags/tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  controllers: [TagController],
  providers: [
    TagService,
    TagDataService,
    TagMapping,
    TagService,
    TagDataService,
  ],
  exports: [TagService],
})
export class TagModule {}
