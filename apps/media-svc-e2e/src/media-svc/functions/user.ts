/* Ignore module boundaries, it's just our test scaffolding */
/* eslint-disable @nx/enforce-module-boundaries */
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { testAndCloneUser } from '../test-components';
import { buildTestCreds, defaultOptionsWithBearer, login } from './auth';
import { CreateUserDto } from '@mediashare/user-svc/src/app/modules/user/dto/create-user.dto';
import { UserDto } from '@mediashare/user-svc/src/app/modules/user/dto/user.dto';
import { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';

export const createUser =
  ({ baseUrl, token }) =>
  async (user) => {
    const dto = {
      sub: randomUUID(),
      ...user,
    } as CreateUserDto;

    return axios.post(`${baseUrl}/user`, dto, defaultOptionsWithBearer(token));
  };
export const createAndValidateTestUser = async (
  createUserFn,
  userData = {
    // Default data
    username: 'jsmith',
    email: 'jsmith@example.com',
    firstName: 'John',
    lastName: 'Smith',
  }
) => {
  return new Promise((resolve, reject) => {
    createUserFn(userData)
      .then((res) => {
        expect(res.status).toEqual(201);
        const user: UserDto = res.data;
        testAndCloneUser(user, userData);
        resolve(user);
      })
      .catch((err) => {
        expect(err).toBeDefined();
        reject(err);
      });
  });
};
export const getTestUserId = (testUser: any) => testUser?._id?.toString();

// TODO: Update so we can supply custom user data
export const initializeTestUser = async (
  baseUrl: string,
  userApiBaseUrl: string
) => {
  try {
    // Login first
    const creds = buildTestCreds();
    const authResponse: AuthenticationResultType = await login(baseUrl, creds);
    console.log(`Logged in`, authResponse);
    // const idToken = jwt.decode(authResponse?.IdToken);
    const {
      sub,
      email,
      phone_number: phoneNumber,
    } = jwt.decode(authResponse?.IdToken) as any;

    const testUserData = {
      sub,
      email,
      username: 'lucas@bluecollardev.com',
      firstName: 'Lucas',
      lastName: 'Lopatka',
      phoneNumber,
    };
    // Create a corresponding user in the database
    const createUserFn = createUser({
      baseUrl: userApiBaseUrl,
      token: authResponse?.IdToken,
    });
    const testUser = await createAndValidateTestUser(createUserFn, testUserData);
    return [testUser, authResponse as AuthenticationResultType];
  } catch (err) {
    throw err;
  }
};
