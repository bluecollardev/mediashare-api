import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { createResponse } from 'node-mocks-http';
import { stub } from 'jest-auto-stub';

import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AdminGuard } from './admin.guard';
import { UserGuard } from './user.guard';
import { UserConnectionService } from '../user-connection/user-connection.service';
import {
  AuthenticationGuard,
  COGNITO_JWT_PAYLOAD_CONTEXT_PROPERTY,
} from '@nestjs-cognito/auth';

/**
 * Backend tests for the QR-invite path. The QR encodes
 * {origin}/invite?from=<sub>. On the recipient side, the flow that
 * actually creates the user is POST /api/user/invite — same path
 * used by the email-invite flow. These tests pin that contract.
 */
describe('UserController.invite (QR + email)', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = stub<UserService>();
  const mockUserConnectionService = stub<UserConnectionService>();
  const mockConfigService: any = {
    get: jest.fn(() => []),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // The controller's routes are decorated with AuthenticationGuard
    // / UserGuard / AdminGuard. Override them as no-ops here so the
    // Cognito module's verifier provider isn't required.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        {
          provide: UserConnectionService,
          useValue: mockUserConnectionService,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(UserGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(UserController);
    userService = module.get(UserService);
  });

  it('creates a subscriber user from the invite body and returns the looked-up profile', async () => {
    const created: any = { _id: 'abc123' };
    const profile: any = {
      _id: 'abc123',
      email: 'newuser@example.com',
      role: 'subscriber',
    };
    (userService.create as any) = jest.fn(async () => created);
    (userService.findById as any) = jest.fn(async () => profile);

    const res = createResponse();
    await controller.invite(res as any, {
      email: 'newuser@example.com',
      username: 'newuser',
    } as any);

    expect(userService.create).toHaveBeenCalledTimes(1);
    const createArg = (userService.create as jest.Mock).mock.calls[0][0];
    expect(createArg.email).toBe('newuser@example.com');
    expect(createArg.username).toBe('newuser');
    // The controller normalizes every invited account to the
    // 'subscriber' role.
    expect(createArg.role).toBe('subscriber');
    expect(userService.findById).toHaveBeenCalledWith('abc123');
    expect(res._getData()).toEqual(profile);
  });
});

describe('AdminGuard (used by admin invite + Manage Users endpoints)', () => {
  const buildCtx = (email?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          [COGNITO_JWT_PAYLOAD_CONTEXT_PROPERTY]: email
            ? { email }
            : {},
        }),
      }),
    } as any);

  const makeGuard = (whitelist: string[]) =>
    new AdminGuard({
      get: jest.fn((key: string, fallback: any) =>
        key === 'app.appAdminUserEmails' ? whitelist : fallback
      ),
    } as any);

  it('allows a whitelisted email', () => {
    const guard = makeGuard(['lucas@bluecollardev.com']);
    expect(guard.canActivate(buildCtx('lucas@bluecollardev.com'))).toBe(
      true
    );
  });

  it('is case-insensitive on the token email (whitelist is lowercased at config load)', () => {
    const guard = makeGuard(['lucas@bluecollardev.com']);
    expect(guard.canActivate(buildCtx('Lucas@BlueCollarDev.com'))).toBe(
      true
    );
  });

  it('rejects a non-whitelisted email with ForbiddenException', () => {
    const guard = makeGuard(['lucas@bluecollardev.com']);
    expect(() => guard.canActivate(buildCtx('stranger@example.com'))).toThrow(
      ForbiddenException
    );
  });

  it('rejects when no email is present on the token', () => {
    const guard = makeGuard(['lucas@bluecollardev.com']);
    expect(() => guard.canActivate(buildCtx(undefined))).toThrow(
      ForbiddenException
    );
  });

  it('rejects when the whitelist is empty (no admins configured)', () => {
    const guard = makeGuard([]);
    expect(() => guard.canActivate(buildCtx('lucas@bluecollardev.com'))).toThrow(
      ForbiddenException
    );
  });
});
