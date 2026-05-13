import { COGNITO_JWT_PAYLOAD_CONTEXT_PROPERTY } from '@nestjs-cognito/auth';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mirror of user-svc's AdminGuard. Each service needs its own copy
// because Nest guards are tied to a single Nest application instance.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const payload = request[COGNITO_JWT_PAYLOAD_CONTEXT_PROPERTY];
    const email = (payload?.email || payload?.['cognito:email'] || '')
      .toString()
      .toLowerCase();
    const whitelist = this.configService.get<string[]>(
      'app.appAdminUserEmails',
      []
    );
    if (!email || !whitelist.includes(email)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
