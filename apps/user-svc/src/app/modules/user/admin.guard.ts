import { COGNITO_JWT_PAYLOAD_CONTEXT_PROPERTY } from '@nestjs-cognito/auth';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Allow only users whose email appears in the `ADMIN_USER_EMAILS`
 * env list (config key `app.appAdminUserEmails`). The list is
 * lowercased at config-load time, so we lowercase the incoming
 * token's email for comparison.
 *
 * Email-based by design: more readable than a Cognito sub list and
 * easier for an operator to maintain across environments. The
 * Cognito email claim is verified at sign-up, so spoofing requires
 * compromising Cognito itself.
 */
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
