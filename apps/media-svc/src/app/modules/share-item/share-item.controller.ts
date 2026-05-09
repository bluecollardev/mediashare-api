import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import { AuthenticationGuard, CognitoUser } from '@nestjs-cognito/auth';
import {
  Controller,
  Param,
  HttpCode,
  UseGuards,
  HttpStatus,
  Res,
  Get,
  Delete,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ParamTokens, RouteTokens } from '@mediashare/core/constants';
import { ShareItemService } from './share-item.service';
import { MediaItemService } from '../media-item/media-item.service';
import { PlaylistService } from '../playlist/playlist.service';
import {
  ShareItemsByUserIdDto,
  ShareItemsDto,
  MediaShareItemDto,
  PlaylistShareItemDto,
  ShareItemsIdsDto,
} from './dto/share-item.dto';
import { ShareItemGetResponse } from './share-item.decorator';
import { ShareItem } from './entities/share-item.entity';
import { MediaItemDto } from '../media-item/dto/media-item.dto';
import { PlaylistDto } from '../playlist/dto/playlist.dto';

@ApiTags('share-items')
@Controller('share-items')
export class ShareItemController {
  constructor(
    private readonly shareItemService: ShareItemService,
    private readonly mediaItemService: MediaItemService,
    private readonly playlistService: PlaylistService
  ) {}

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Post(`user/${RouteTokens.userSub}/playlist/${RouteTokens.playlistId}`)
  @ApiParam({ name: ParamTokens.playlistId, type: String, required: true })
  @ApiParam({ name: ParamTokens.userSub, type: String, required: true })
  @ShareItemGetResponse({ type: PlaylistShareItemDto, isArray: true })
  async sharePlaylist(
    @Param(ParamTokens.playlistId) playlistId: string,
    @Param(ParamTokens.userSub) userSub: string,
    @CognitoUser('sub') createdBy: string,
    @Res() res: Response
  ) {
    try {
      const { title } = await this.playlistService.findOne(playlistId);
      if (!title && !createdBy) return res.status(HttpStatus.NOT_FOUND);

      const result = await this.shareItemService.createPlaylistShareItem({
        userSub,
        playlistId,
        createdBy,
      });
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Post(`user/${RouteTokens.userSub}/media-item/${RouteTokens.mediaId}`)
  @ApiParam({ name: ParamTokens.mediaId, type: String, required: true })
  @ApiParam({ name: ParamTokens.userSub, type: String, required: true })
  @ShareItemGetResponse({ type: MediaShareItemDto, isArray: true })
  async shareMediaItem(
    @Param(ParamTokens.mediaId) mediaId: string,
    @Param(ParamTokens.userSub) userSub: string,
    @CognitoUser('sub') createdBy: string,
    @Res() res: Response
  ) {
    try {
      const { title } = await this.mediaItemService.findOne(mediaId);
      if (!title && !createdBy) return res.status(HttpStatus.NOT_FOUND);

      const result = await this.shareItemService.createMediaShareItem({
        createdBy,
        userSub,
        mediaId,
      });
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-by-user')
  @ShareItemGetResponse({ type: ShareItemsDto, isArray: true })
  async findItemsSharedByUser(@CognitoUser('sub') userSub: string) {
    return await this.shareItemService.getItemsSharedByUser(userSub);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-by-user/media-items')
  @ShareItemGetResponse({ type: MediaItemDto, isArray: true })
  async findMediaItemsSharedByUser(@CognitoUser('sub') userSub: string) {
    return await this.shareItemService.getMediaItemsSharedByUser(userSub);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-by-user/playlists')
  @ShareItemGetResponse({ type: PlaylistDto, isArray: true })
  async findPlaylistsSharedByUser(@CognitoUser('sub') userSub: string) {
    return await this.shareItemService.getPlaylistsSharedByUser(userSub);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-with-user')
  @ShareItemGetResponse({ type: ShareItemsDto, isArray: false })
  async findItemsSharedWithUser(@CognitoUser('sub') userSub: string) {
    const result = await this.shareItemService.getItemsSharedWithUser(userSub);
    return result;
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-with-user/media-items')
  @ShareItemGetResponse({ type: MediaItemDto, isArray: true })
  async findMediaItemsSharedWithUser(@CognitoUser('sub') userSub: string) {
    return await this.shareItemService.getMediaItemsSharedWithUser(userSub);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('shared-with-user/playlists')
  @ShareItemGetResponse({ type: PlaylistDto, isArray: true })
  async findPlaylistsSharedWithUser(@CognitoUser('sub') userSub: string) {
    return await this.shareItemService.getPlaylistsSharedWithUser(userSub);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.shareId, type: String, required: true })
  @Get(RouteTokens.shareId)
  @ShareItemGetResponse()
  async findShareItem(@Param(ParamTokens.shareId) shareId: string) {
    return await this.shareItemService.dataService.findOne(shareId);
  }

  // TODO: Why do we care about this? Can we delete?
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.shareId, type: String, required: true })
  @ApiResponse({ type: ShareItem, status: 200 })
  @Post(`read/${RouteTokens.shareId}`) // TODO: Why is this a POST? Shouldn't we be using ShareItemPostResponse as well?
  @HttpCode(HttpStatus.OK)
  async readShareItem(@Param(ParamTokens.shareId) shareId: string) {
    return await this.shareItemService.dataService.update(shareId, {
      // read: true,
    });
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiParam({ name: ParamTokens.shareId, type: String, required: true })
  @Delete(RouteTokens.shareId)
  @ShareItemGetResponse()
  async removeShareItem(@Param(ParamTokens.shareId) shareId: string) {
    return await this.shareItemService.dataService.remove(shareId);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Post('unshare-all-items')
  @ApiBody({ type: () => ShareItemsDto })
  async removeAllShareItems(@Body() shareItemsDto: ShareItemsIdsDto) {
    await this.shareItemService.removeShareItems(shareItemsDto.shareItemIds);
  }

  // TODO: Fix me!
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Post('unshare-all-by-user-id')
  @ApiBody({ type: () => ShareItemsByUserIdDto })
  async removeShareItemAllByUserId(
    @Body() shareItemsByUserIdDto: ShareItemsByUserIdDto
  ) {
    // await this.shareItemService.removeUserConnectionShareItems(shareItemsByUserIdDto.shareItemByUserIds);
  }
}
