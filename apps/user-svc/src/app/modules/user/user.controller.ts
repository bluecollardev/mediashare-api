import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthenticationGuard, CognitoUser } from '@nestjs-cognito/auth';
import {
  Controller,
  Body,
  HttpStatus,
  Get,
  Post,
  Put,
  Req,
  Res,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import {
  handleErrorResponse,
  handleSuccessResponse,
} from '@mediashare/core/http/response';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserConnectionDto } from '../user-connection/dto/user-connection.dto';
import { CreateUserConnectionDto } from '../user-connection/dto/create-user-connection.dto';
// import { UpdateUserConnectionDto } from '../user-connection/tags/update-user-connection.tags';
import { UserConnectionService } from '../user-connection/user-connection.service';
import { UserDto } from './dto/user.dto';
import { AuthorizeDto, InviteDto } from './dto/authorize.dto';
import { ProfileDto } from './dto/profile.dto';
import { UserService } from './user.service';
import { UserGetResponse, UserPostResponse } from './user.decorator';
import { UserGuard } from './user.guard';
import { AdminGuard } from './admin.guard';
import { GetUser } from '@mediashare/core/decorators/user.decorator';
import { ConfigService } from '@nestjs/config';

import { defaultImgUrl, defaultUserRole } from './user.constants';

@ApiTags('user')
@Controller({ path: ['user'] })
export class UserController {
  constructor(
    private userService: UserService,
    private userConnectionService: UserConnectionService,
    private readonly configService: ConfigService /*private shareItemService: ShareItemService,
    private mediaItemService: MediaItemService*/
  ) {}

  private isAdminEmail(email?: string): boolean {
    if (!email) return false;
    const whitelist = this.configService.get<string[]>(
      'app.appAdminUserEmails',
      []
    );
    return whitelist.includes(email.toLowerCase());
  }

  @Post('authorize')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiResponse({ type: ProfileDto, isArray: false, status: 200 })
  async authorize(
    @Req() req: Request,
    @Res() res: Response,
    @CognitoUser() cognitoUser: any
  ) {
    // const valid = this.userService.validateToken({ token: accessToken, idToken });
    // if (!valid) throw new UnauthorizedException();
    const user = cognitoUser; // await this.userService.findByQuery({ sub: valid.sub } as any);

    /*res.setHeader('Authorization', cognitoUser);
    res.setHeader('Id', idToken);
    if (!user) {
      const newUser = await this.userService.create({
        // ...valid,
        // TODO: All new users should probably be free, not subscribers, complete this!
        role: 'subscriber',
        // TODO: Replace this string!
        imageSrc: 'https://mediashare0079445c24114369af875159b71aee1c04439-dev.s3.us-west-2.amazonaws.com/public/assets/default-user.png',
      } as any);
      const profile = await this.userService.findById(newUser._id.toString());
      if (!profile) return res.send(user);
      return res.send(profile);
    }*/
    const profile = await this.userService.findById(user._id.toString());
    if (!profile) return res.send(user);

    // return res.send(profile) */
  }

  @Post('invite')
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiBody({ type: InviteDto })
  @ApiResponse({ type: ProfileDto, isArray: false, status: 200 })
  async invite(@Res() res: Response, @Body() inviteDto: InviteDto) {
    const newUser = await this.userService.create({
      email: inviteDto.email,
      username: inviteDto.username,
      role: 'subscriber',
      imageSrc: `${process.env['AWS_URL']}/assets/default-user.png`,
    } as CreateUserDto);
    const profile = await this.userService.findById(newUser._id);
    return res.send(profile);
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    //req.logout();
    res.setHeader('Authorization', '');
    res.setHeader('Id', '');
    return res.status(HttpStatus.OK).send();
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateUserConnectionDto })
  @Post('/connections/create')
  async createUserConnection(@Req() req: Request, @Res() res: Response) {
    try {
      // We do it this way instead of using the decorator on purpose
      const userConnectionDto: CreateUserConnectionDto = req.body;
      const result = await this.userConnectionService.create(userConnectionDto);
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get('/connections')
  @UserGetResponse({ type: UserDto, isArray: true }) // TODO: Use ProfileDto
  async getCurrentUserConnections(
    @Res() res: Response,
    @GetUser('sub') userSub: string
  ) {
    try {
      const userConnections = await this.userConnectionService.findConnections(
        userSub
      );
      const connectionUserSubs = userConnections.map((uc) => uc.connectionId);

      const result = await this.userService.findBySubs(connectionUserSubs);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @Get('/connections/:userId')
  @UserGetResponse({ type: UserDto, isArray: true }) // TODO: Use ProfileDto
  async getUserConnections(
    @Res() res: Response,
    @Param('userId') userSub: string
  ) {
    try {
      const userConnections = await this.userConnectionService.findConnections(
        userSub
      );
      const userConnectionSubs = userConnections.map((uc) => uc.connectionId);

      const result = await this.userService.findBySubs(userConnectionSubs);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UserConnectionDto, isArray: false })
  @Post('/connection/remove')
  async removeUserConnection(
    @Req() req: Request,
    @Res() res: Response,
    @Body() userConnectionDto: UserConnectionDto
  ) {
    try {
      const { userId, connectionId } = req.body as any;
      if (!userId || !connectionId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: `User ID and Connection ID are required fields`,
        });
      }
      if (userId === connectionId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: 400,
          message: `User ID and Connection ID cannot be the same`,
        });
      }
      const result = await this.userConnectionService.remove(userConnectionDto);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UserConnectionDto, isArray: true })
  @Post('/connections/remove')
  async removeUserConnections(
    @Req() req: Request,
    @Res() res: Response,
    @Body() userConnectionDtos: UserConnectionDto[]
  ) {
    // eslint-disable-next-line no-useless-catch
    try {
      // TODO: Add this functionality back in
      // const shareItemsResult = await this.shareItemService.removeUserConnectionShareItems(userConnectionDtos);
      // if (shareItemsResult) {
      const userConnectionResult = await this.userConnectionService.removeMany(
        userConnectionDtos
      );
      return handleSuccessResponse(res, HttpStatus.OK, userConnectionResult);
      // }

      /* return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        message: `There was a problem removing user connection share items`,
      }); */
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @Post()
  @UserPostResponse({ type: UserDto })
  async createUser(@Res() res: Response, @Body() createUserDto: CreateUserDto) {
    try {
      // TODO: Only create if username and / or sub claim is unique!
      const result = await this.userService.create(createUserDto);
      return handleSuccessResponse(res, HttpStatus.CREATED, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  /**
   * Admin: flip the isDisabled flag on a user. Used by Manage Users
   * for single + bulk suspend. UI keys the suspended/active state off
   * of `isDisabled` to avoid yet another schema field.
   */
  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', type: String, required: true })
  @Post('/admin/users/:userId/suspend')
  async suspendUser(
    @Res() res: Response,
    @Param('userId') userId: string
  ) {
    try {
      // Refuse to suspend another admin — admins can't be locked out
      // by their peers. The whitelist (ADMIN_USER_EMAILS) is the
      // source of truth; DB role is informational.
      const target: any = await this.userService.dataService.repository
        .aggregate([{ $match: { _id: this.toObjectId(userId) } }])
        .next();
      if (target && this.isAdminEmail(target.email)) {
        return res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Admin accounts cannot be suspended.',
        });
      }
      const result = await this.userService.dataService.repository.updateOne(
        { _id: this.toObjectId(userId) },
        { $set: { isDisabled: true } }
      );
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', type: String, required: true })
  @Post('/admin/users/:userId/unsuspend')
  async unsuspendUser(
    @Res() res: Response,
    @Param('userId') userId: string
  ) {
    try {
      const result = await this.userService.dataService.repository.updateOne(
        { _id: this.toObjectId(userId) },
        { $set: { isDisabled: false } }
      );
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  // Lazy ObjectId helper — keeps the import surface in this file
  // small; an explicit module-level helper would be fine if more
  // routes need it.
  private toObjectId(id: string): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  }

  /**
   * Admin-only: list every user. Declared *before* `/:userId` so the
   * literal 'admin' segment isn't matched as an id.
   */
  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @Get('/admin/users')
  @UserGetResponse({ type: UserDto, isArray: true })
  async listUsersForAdmin(@Res() res: Response) {
    try {
      // Use the mongo native aggregate() instead of TypeORM .find() —
      // the latter returned [] in TypeORM 0.3 against this driver
      // setup. An empty pipeline streams every document.
      const rows = await this.userService.dataService.repository
        .aggregate([])
        .toArray();
      const result = rows.map((u: any) => ({
        ...u,
        isAdmin: this.isAdminEmail(u?.email),
      }));
      // Express auto-generates an ETag; the rxjs ajax runtime treats
      // any non-2xx (including 304 Not Modified) as a throw, which
      // would reject the thunk and the admin list would appear empty
      // on every refetch after the first. Force fresh on each call.
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'sub', type: String, required: true })
  @Get('/sub/:sub')
  @UserGetResponse({ type: UserDto }) // TODO: Change this back to ProfileDto
  async getUserBySub(@Res() res: Response, @Param('sub') sub: string) {
    try {
      const result = await this.userService.findByQuery({ where: { sub } });
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', type: String, required: true })
  @Get('/:userId')
  @UserGetResponse({ type: UserDto }) // TODO: Change this back to ProfileDto
  async getUser(@Res() res: Response, @Param('userId') userId: string) {
    try {
      // Callers from the Shared/Contact pages pass a Cognito sub
      // (UUID) here; older callers pass a Mongo ObjectId. Detect by
      // shape — a 24-char hex string is treated as an _id, anything
      // else (UUIDs are 36 chars with hyphens) is looked up by sub.
      const isObjectId = /^[a-f0-9]{24}$/i.test(userId);
      const result = isObjectId
        ? await this.userService.findById(userId)
        : await this.userService.findByQuery({ where: { sub: userId } });
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Get()
  @UserGetResponse({ type: UserDto }) // TODO: Change this back to ProfileDto
  async getCurrentUser(@Res() res: Response, @GetUser('_id') userId: string) {
    try {
      const result: any = await this.userService.findById(userId);
      // Cheap inline isAdmin flag so the frontend can gate UI off the
      // already-fetched current-user payload — no extra request.
      if (result) result.isAdmin = this.isAdminEmail(result.email);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpdateUserDto })
  @Put()
  @UserPostResponse({ type: UserDto })
  async updateCurrentUser(
    @Res() res: Response,
    @GetUser('_id') userId: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    try {
      const result = await this.userService.update(userId, updateUserDto);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', type: String, required: true })
  @ApiBody({ type: UpdateUserDto })
  @Put('/:userId')
  @UserPostResponse({ type: UserDto })
  async updateUser(
    @Res() res: Response,
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    try {
      const result = await this.userService.update(userId, updateUserDto);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, UserGuard)
  @ApiBearerAuth()
  @Delete()
  async deleteCurrentUser(
    @Res() res: Response,
    @GetUser('_id') userId: string
  ) {
    try {
      const result = await this.userService.remove(userId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }

  @UseGuards(AuthenticationGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', type: String, required: true })
  @Delete('/:userId')
  async deleteUser(@Res() res: Response, @Param('userId') userId: string) {
    try {
      const target: any = await this.userService.dataService.repository
        .aggregate([{ $match: { _id: this.toObjectId(userId) } }])
        .next();
      if (target && this.isAdminEmail(target.email)) {
        return res.status(HttpStatus.FORBIDDEN).json({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Admin accounts cannot be deleted.',
        });
      }
      const result = await this.userService.remove(userId);
      return handleSuccessResponse(res, HttpStatus.OK, result);
    } catch (error) {
      return handleErrorResponse(res, error);
    }
  }
}
