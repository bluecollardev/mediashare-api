import { MediaItemService } from '../media-item/media-item.service';
import { Controller, Query, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticationGuard, CognitoUser } from '@nestjs-cognito/auth';
import { PlaylistGetResponse } from './search.decorator';
import { PlaylistService } from '../playlist/playlist.service';
import { PlaylistDto } from '../playlist/dto/playlist.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly mediaItemService: MediaItemService
  ) {}

  /**
   * Authenticated search: returns the user's own content UNION the configured
   * app-subscriber-content (master) creators' public/subscription content.
   * Drives the in-app Search page.
   */
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get()
  @ApiQuery({ name: 'text', required: false, allowEmptyValue: true })
  @ApiQuery({
    name: 'tags',
    type: String,
    explode: true,
    isArray: true,
    required: false,
    allowEmptyValue: true,
  })
  @PlaylistGetResponse({ type: PlaylistDto, isArray: true })
  async findAll(
    @CognitoUser('sub') userId: string,
    @Query('target') target?: string,
    @Query('text') query?: string,
    @Query('tags') tags?: string[]
  ) {
    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? [tags]
      : undefined;
    let results = [];
    switch (target) {
      case 'media':
        results = await this.mediaItemService.search({
          userId,
          query,
          tags: parsedTags,
        });
        results = results.map((result) => ({
          ...result,
          contentType: 'mediaItem',
        }));
        break;
      // Subscriber-content-only targets. Skip userId so the service runs
      // the else-branch of buildAggregateQuery — matching only the
      // configured app-subscriber-content creators' public/subscription
      // content. Used by Library "Include Network Content" toggle.
      case 'network-playlists':
        results = await this.playlistService.search({
          query,
          tags: parsedTags,
        });
        results = results.map((result) => ({
          ...result,
          contentType: 'playlist',
        }));
        break;
      case 'network-media':
        results = await this.mediaItemService.search({
          query,
          tags: parsedTags,
        });
        results = results.map((result) => ({
          ...result,
          contentType: 'mediaItem',
        }));
        break;
      case 'playlists':
        results = await this.playlistService.search({
          userId,
          query,
          tags: parsedTags,
        });
        results = results.map((result) => ({
          ...result,
          contentType: 'playlist',
        }));
        break;
      // Union of playlists + media items, both unioned with the
      // configured subscriber-content creators.
      case 'all':
      default: {
        const [playlists, media] = await Promise.all([
          this.playlistService.search({ userId, query, tags: parsedTags }),
          this.mediaItemService.search({ userId, query, tags: parsedTags }),
        ]);
        results = [
          ...playlists.map((r) => ({ ...r, contentType: 'playlist' })),
          ...media.map((r) => ({ ...r, contentType: 'mediaItem' })),
        ];
        break;
      }
    }
    return results;
  }

  @Get('popular')
  @PlaylistGetResponse({ isArray: true })
  async findPopular() {
    return await this.playlistService.getPopular();
  }
}
