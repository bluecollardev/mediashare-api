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
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ParamTokens, RouteTokens } from '@mediashare/core/constants';
import { PLAYLIST_VISIBILITY } from '../../core/models';
import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import {
  PlaylistGetResponse,
  PlaylistPostResponse,
  PlaylistPutResponse,
} from './playlist.decorator';
import { PlaylistService } from './playlist.service';
import { PlaylistDto } from './dto/playlist.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@ApiTags('playlists')
@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get('visibilities')
  getVisibilities() {
    return { visibilities: PLAYLIST_VISIBILITY };
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreatePlaylistDto })
  @Post()
  @PlaylistPostResponse({ type: PlaylistDto })
  async create(
    @Res() res: Response,
    @Body() createPlaylistDto: CreatePlaylistDto,
    @CognitoUser('sub') userId: string
  ) {
    try {
      const result = await this.playlistService.create({
        ...createPlaylistDto,
        createdBy: userId,
        cloneOf: createPlaylistDto?.cloneOf
          ? createPlaylistDto.cloneOf
          : undefined,
      });
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: ParamTokens.playlistId,
    type: String,
    required: true,
    example: '123',
  })
  @ApiBody({ type: UpdatePlaylistDto })
  @Put(RouteTokens.playlistId)
  @PlaylistPutResponse()
  async update(
    @Res() res: Response,
    @Param(ParamTokens.playlistId) playlistId: string,
    @CognitoUser('sub') userId: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto
  ) {
    try {
      const result = await this.playlistService.update(
        playlistId,
        updatePlaylistDto
      );
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Delete(RouteTokens.playlistId)
  @ApiParam({
    name: ParamTokens.playlistId,
    type: String,
    required: true,
    example: '123',
  })
  async remove(
    @Res() res: Response,
    @Param(ParamTokens.playlistId) playlistId: string
  ) {
    try {
      const result = await this.playlistService.remove(playlistId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get(RouteTokens.playlistId)
  @ApiParam({
    name: ParamTokens.playlistId,
    type: String,
    required: true,
    example: '123',
  })
  @PlaylistGetResponse()
  async findOne(
    @Res() res: Response,
    @Param(ParamTokens.playlistId) playlistId: string
  ) {
    try {
      const result = await this.playlistService.getById(playlistId);
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
  @PlaylistGetResponse({ type: PlaylistDto, isArray: true })
  async findAll(
    @Res() res: Response,
    @CognitoUser('sub') userId: string,
    @Query('text') query?: string,
    @Query('tags') tags?: string[]
  ) {
    try {
      const parsedTags = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
        ? [tags]
        : undefined;
      // Library / "My Playlists" endpoint — owner-only by design. AFehr's
      // subscriber content shouldn't appear here unless the user has cloned
      // it (creating their own copy). Search uses /api/search and gets the
      // unioned view.
      const result = await this.playlistService.search({
        userId,
        query,
        tags: parsedTags,
        ownerOnly: true,
      });
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }
}
