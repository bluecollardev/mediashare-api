import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { ApiControllerDecoratorParams } from '@mediashare/shared';
import { CreateTagDto } from '@mediashare/core/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@mediashare/core/modules/tags/dto/update-tag.dto';
import { TagDto } from '@mediashare/core/modules/tags/dto/tag.dto';
import { Tag } from '@mediashare/core/modules/tags/tag.entity';

export function TagGetResponse({
  type = TagDto,
  isArray = false,
  description,
}: ApiControllerDecoratorParams = {}) {
  // TODO: Don't worry no auth here!
  // return applyDecorators(ApiResponse({ type, isArray, description, status: 200 }), UseJwtGuard());
  return applyDecorators(
    ApiResponse({ type, isArray, description, status: 200 })
  );
}

export function TagPostResponse({
  type = Tag,
  isArray = false,
  description,
}: ApiControllerDecoratorParams = {}) {
  // TODO: Fix auth!
  // return applyDecorators(ApiResponse({ type, isArray, description, status: 201 }), ApiBody({ type: CreateTagDto }), UseJwtGuard());
  return applyDecorators(
    ApiResponse({ type, isArray, description, status: 201 }),
    ApiBody({ type: CreateTagDto })
  );
}

export function TagPutResponse({
  type = Tag,
  isArray = false,
  description,
}: ApiControllerDecoratorParams = {}) {
  // TODO: Fix auth!
  // return applyDecorators(ApiResponse({ type, isArray, description, status: 200 }), ApiBody({ type: UpdateTagDto }), UseJwtGuard());
  return applyDecorators(
    ApiResponse({ type, isArray, description, status: 200 }),
    ApiBody({ type: UpdateTagDto })
  );
}
