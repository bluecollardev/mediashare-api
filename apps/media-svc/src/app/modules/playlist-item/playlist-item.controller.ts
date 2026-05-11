import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import { AuthenticationGuard, CognitoUser } from '@nestjs-cognito/auth';
import {
  Controller,
  Body,
  Param,
  Query,
  Get,
  Post,
  Put,
  Delete,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ParamTokens, RouteTokens } from '@mediashare/core/constants';
import { MEDIA_VISIBILITY } from '../../core/models';
import {
  PlaylistItemGetResponse,
  PlaylistItemPostResponse,
  PlaylistItemPutResponse,
} from './playlist-item.decorator';
import { PlaylistItemService } from './playlist-item.service';
import { CreatePlaylistItemDto } from './dto/create-playlist-item.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { PlaylistItem } from './entities/playlist-item.entity';
import { MediaItemService } from '../media-item/media-item.service';

@ApiTags('playlist-items')
@Controller('playlist-items')
export class PlaylistItemController {
  constructor(
    private readonly playlistItemService: PlaylistItemService,
    private mediaItemService: MediaItemService
  ) {}

  @Get('visibilities')
  getVisibilities() {
    return MEDIA_VISIBILITY;
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Post()
  @PlaylistItemPostResponse()
  async create(
    @Res() res: Response,
    @Body() createPlaylistItemDto: CreatePlaylistItemDto,
    @CognitoUser('sub') createdBy: string
  ) {
    try {
      const playlistId = createPlaylistItemDto?.playlistId;
      const mediaId = createPlaylistItemDto?.mediaId;
      const sortIndex = createPlaylistItemDto?.sortIndex;
      const mediaItem = await this.mediaItemService.findOne(mediaId);
      delete mediaItem._id;
      const playlistItem: Omit<PlaylistItem, '_id'> = {
        isPlayable: false,
        uri: '',
        ...mediaItem,
        createdBy,
        playlistId: playlistId,
        mediaId: mediaId,
        sortIndex,
      } as any;
      const result = await this.playlistItemService.create({
        ...playlistItem,
      } as any);
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.playlistItemId, type: String, required: true })
  @Put(RouteTokens.playlistItemId)
  @PlaylistItemPutResponse()
  async update(
    @Res() res: Response,
    @Param(ParamTokens.playlistItemId) playlistItemId: string,
    @Body() updatePlaylistItemDto: UpdatePlaylistItemDto
  ) {
    try {
      const result = await this.playlistItemService.update(
        playlistItemId,
        updatePlaylistItemDto
      );
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.playlistItemId, type: String, required: true })
  @Delete(RouteTokens.playlistItemId)
  async remove(
    @Res() res: Response,
    @Param(ParamTokens.playlistItemId) playlistItemId: string
  ) {
    try {
      const result = await this.playlistItemService.remove(playlistItemId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  // NOTE: declared BEFORE the `:playlistItemId` route so '/popular' doesn't
  // get matched as `findOne('popular')` (which then fails ObjectIdGuard).
  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get('popular')
  @PlaylistItemGetResponse({ isArray: true })
  async findPopular(@Res() res: Response) {
    try {
      const result = await this.playlistItemService.getPopular();
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.playlistItemId, type: String, required: true })
  @Get(RouteTokens.playlistItemId)
  @PlaylistItemGetResponse()
  async findOne(
    @Res() res: Response,
    @Param(ParamTokens.playlistItemId) playlistItemId: string
  ) {
    try {
      const result = await this.playlistItemService.getById(playlistItemId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'text', required: false, allowEmptyValue: true })
  @ApiQuery({
    name: 'tags',
    type: String,
    explode: true,
    isArray: true,
    required: false,
    allowEmptyValue: true,
  })
  @Get()
  @PlaylistItemGetResponse({ isArray: true })
  async findAll(
    @Res() res: Response,
    @Query('text') query?: string,
    @Query('tags') tags?: string[]
  ) {
    try {
      const parsedTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? [tags]
        : undefined;
      // Always search, we want to run the aggregate query in every case
      const result =
        query || tags
          ? await this.playlistItemService.search({ query, tags: parsedTags })
          : await this.playlistItemService.search({});
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }
}
