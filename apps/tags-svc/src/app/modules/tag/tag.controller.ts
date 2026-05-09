import { AuthenticationGuard, CognitoUser } from '@nestjs-cognito/auth';
import {
  Controller,
  Body,
  Param,
  Get,
  Post,
  Put,
  Delete,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ParamTokens, RouteTokens } from '@mediashare/core/constants';
import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import {
  TagGetResponse,
  TagPostResponse,
  TagPutResponse,
} from './tag.decorator';
import { TagService } from './tag.service';
import { TagDto } from '@mediashare/core/modules/tags/dto/tag.dto';
import { CreateTagDto } from '@mediashare/core/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@mediashare/core/modules/tags/dto/update-tag.dto';

@ApiTags('tags')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateTagDto })
  @Post()
  @TagPostResponse({ type: TagDto })
  async create(
    @Res() res: Response,
    @Body() createTagDto: CreateTagDto,
    @CognitoUser('sub') userId: string
  ) {
    try {
      const result = await this.tagService.create({
        ...createTagDto,
        // createdBy: userId,
        /* cloneOf: createTagDto?.cloneOf
          ? createTagDto.cloneOf
          : undefined, */
      });
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiParam({
    name: ParamTokens.tagId,
    type: String,
    required: true,
    example: '123',
  })
  @ApiBody({ type: UpdateTagDto })
  @Put(RouteTokens.tagId)
  @TagPutResponse()
  async update(
    @Res() res: Response,
    @Param(ParamTokens.tagId) tagId: string,
    @CognitoUser('sub') userId: string,
    @Body() updateTagDto: UpdateTagDto
  ) {
    try {
      const result = await this.tagService.update(tagId, updateTagDto);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Delete(RouteTokens.tagId)
  @ApiParam({
    name: ParamTokens.tagId,
    type: String,
    required: true,
    example: '123',
  })
  async remove(@Res() res: Response, @Param(ParamTokens.tagId) tagId: string) {
    try {
      const result = await this.tagService.remove(tagId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get(RouteTokens.tagId)
  @ApiParam({
    name: ParamTokens.tagId,
    type: String,
    required: true,
    example: '123',
  })
  @TagGetResponse()
  async findOne(@Res() res: Response, @Param(ParamTokens.tagId) tagId: string) {
    try {
      const result = await this.tagService.findOne(tagId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard) // @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get()
  @TagGetResponse({ type: TagDto, isArray: true })
  async findAll(@Res() res: Response) {
    try {
      const result = await this.tagService.findAll();
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }
}
