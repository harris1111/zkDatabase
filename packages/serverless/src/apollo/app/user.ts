import {
  TMinaSignature,
  TUser,
  TUserFindRequest,
  TUserFindResponse,
  TUserSignInRequest,
  TUserSignInResponse,
  TUserSignUpInput,
  TUserSignUpRequest,
  TUserSignUpResponse,
} from '@zkdb/common';
import { randomUUID } from 'crypto';
import GraphQLJSON from 'graphql-type-json';
import Joi from 'joi';
import Client from 'mina-signer';
import { DEFAULT_PAGINATION } from '../../common/const.js';
import {
  findUser as findUserDomain,
  signUpUser,
} from '../../domain/use-case/user.js';
import { gql } from '../../helper/common.js';
import config from '../../helper/config.js';
import {
  ACCESS_TOKEN_EXPIRE_TIME,
  calculateAccessTokenDigest,
  headerToAccessToken,
  JwtAuthorization,
} from '../../helper/jwt.js';
import RedisInstance from '../../helper/redis.js';
import { sessionDestroy } from '../../helper/session.js';
import ModelUser from '../../model/global/user.js';
import { authorizeWrapper, publicWrapper } from '../validation.js';
import { pagination } from './common.js';

const timestamp = Joi.number()
  .custom((value, helper) => {
    // 5 minutes is the timeout for signing up proof
    const timeDiff = Math.floor(Date.now() / 1000) - value;
    if (timeDiff >= 0 && timeDiff < 300) {
      return value;
    }
    return helper.error('Invalid timestamp of time proof');
  })
  .required();

export const SignatureProof = Joi.object<TMinaSignature>({
  signature: Joi.object({
    field: Joi.string()
      .pattern(/[0-9]+/)
      .required(),
    scalar: Joi.string()
      .pattern(/[0-9]+/)
      .required(),
  }).required(),
  publicKey: Joi.string()
    .min(40)
    .pattern(/^[A-HJ-NP-Za-km-z1-9]*$/)
    .required(),
  data: Joi.string().required(),
});

export const SignInRequest = Joi.object<TUserSignInRequest>({
  proof: SignatureProof.required(),
});

export const UserSignUpInput = Joi.object<TUserSignUpInput>({
  userName: Joi.string().required(),
  email: Joi.string().email().required(),
  timestamp,
  userData: Joi.object().optional(),
});

export const SignUpRequest = Joi.object<TUserSignUpRequest>({
  newUser: UserSignUpInput,
  proof: SignatureProof.required(),
});

export const UserFindRequest = Joi.object<TUserFindRequest>({
  query: Joi.object<TUser>({
    userName: Joi.string().min(1).max(256),
    email: Joi.string().email(),
    publicKey: Joi.string().min(1).max(256),
  }),
  pagination,
});

export const typeDefsUser = gql`
  #graphql
  scalar JSON
  type Query
  type Mutation

  input SignUpInput {
    userName: String!
    email: String!
    publicKey: String!
    userData: JSON
    timestamp: Int!
  }

  type SignUpResponse {
    userName: String!
    email: String!
    userData: JSON
    publicKey: String!
    activated: Boolean!
    createAt: String!
    updatedAt: String!
  }

  type SignInResponse {
    userName: String!
    accessToken: String!
    userData: JSON!
    publicKey: String!
    email: String!
  }

  type User {
    userName: String
    email: String
    publicKey: String
    activated: Boolean!
  }

  type UserFindResponse {
    data: [User]!
    total: Int!
    offset: Int!
  }

  input UserFindQueryInput {
    userName: String
    email: String
    publicKey: String
  }

  extend type Query {
    userMe: SignInResponse

    userFind(
      query: UserFindQueryInput
      pagination: PaginationInput
    ): UserFindResponse
  }

  extend type Mutation {
    userSignIn(proof: ProofInput!): SignInResponse

    userEcdsaChallenge: String!

    userSignOut: Boolean!

    userSignUp(newUser: SignUpInput!, proof: ProofInput!): SignUpResponse
  }
`;

// Query
const userMe = authorizeWrapper(async (_root, _args, context) => {
  const user = await new ModelUser().findOne({
    userName: context.userName,
  });
  if (user) {
    return user;
  }
  throw new Error('User not found');
});

const userFind = publicWrapper<TUserFindRequest, TUserFindResponse>(
  UserFindRequest,
  async (_root, args) => {
    const result = await findUserDomain(
      args.query,
      args.pagination || DEFAULT_PAGINATION
    );
    return result;
  }
);

const userEcdsaChallenge = publicWrapper(async (_root, _args, context) => {
  const { req } = context;
  // Create new session and store ECDSA challenge
  req.session.ecdsaChallenge = `Please sign this message with your wallet to signin zkDatabase: ${randomUUID()}`;

  req.session.save();

  return req.session.ecdsaChallenge;
});

const userSignIn = publicWrapper<TUserSignInRequest, TUserSignInResponse>(
  SignInRequest,
  async (_root, args, context) => {
    if (typeof context.req.session.ecdsaChallenge !== 'string') {
      throw new Error('Invalid ECDSA challenge');
    }

    const client = new Client({ network: config.NETWORK_ID });

    if (args.proof.data !== context.req.session.ecdsaChallenge) {
      throw new Error('Invalid challenge message');
    }

    if (client.verifyMessage(args.proof)) {
      const modelUser = new ModelUser();
      const user = await modelUser.findOne({
        publicKey: args.proof.publicKey,
      });

      if (user) {
        const { userName, email, publicKey, userData, activated } = user;
        const accessToken = await JwtAuthorization.sign({ userName, email });
        const accessTokenDigest = calculateAccessTokenDigest(accessToken);
        await RedisInstance.accessTokenDigest(accessTokenDigest).set(
          JSON.stringify({ userName, email }),
          { EX: ACCESS_TOKEN_EXPIRE_TIME }
        );
        return {
          userData,
          publicKey,
          email,
          userName,
          accessToken,
          activated,
        };
      }
      throw new Error('User not found');
    }
    throw new Error('Signature is not valid');
  }
);

const userSignOut = authorizeWrapper<unknown, boolean>(
  async (_root, _args, context) => {
    const { req } = context;
    if (req.headers.authorization) {
      const accessTokenDigest = calculateAccessTokenDigest(
        headerToAccessToken(req.headers.authorization)
      );
      await RedisInstance.accessTokenDigest(accessTokenDigest).delete();
    }
    await sessionDestroy(req);
    return true;
  }
);

const userSignUp = publicWrapper<TUserSignUpRequest, TUserSignUpResponse>(
  SignUpRequest,
  async (_root, args) => {
    const {
      newUser: { userData, userName, email },
      proof,
    } = args;
    const result = signUpUser(
      {
        userName,
        email,
        publicKey: proof.publicKey,
        userData,
        activated: true,
      },
      proof
    );
    return result;
  }
);

export const resolversUser = {
  JSON: GraphQLJSON,
  Query: {
    userMe,
    userFind,
  },
  Mutation: {
    userEcdsaChallenge,
    userSignIn,
    userSignOut,
    userSignUp,
  },
};
