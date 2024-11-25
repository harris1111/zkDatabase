import { isNetwork } from '@utils';
import { ApiClient, IApiClient } from '@zkdb/api';
import { NetworkId, PrivateKey } from 'o1js';
import { Authenticator } from '../authentication';
import { ZKSystemImpl, ZKDatabaseImpl } from '../impl';
import { ZKSystem, ZKDatabase } from '../interfaces';
import { AuroWalletSigner, NodeSigner, Signer } from '../signer';

type MinaConfig = {
  networkUrl: string;
  networkId: NetworkId;
};
export class ZKDatabaseClient {
  public apiClient: IApiClient;

  public authenticator: Authenticator;

  public minaConfig: MinaConfig;

  private constructor(
    apiClient: IApiClient,
    authenticator: Authenticator,
    minaConfig: MinaConfig
  ) {
    this.apiClient = apiClient;
    this.authenticator = authenticator;
    this.minaConfig = minaConfig;
    apiClient.api.setContext(() =>
      authenticator.isLoggedIn() ? authenticator.getAccessToken() : undefined
    );
  }

  /**
   * Create new instance of ZKDatabaseClient by url
   * Connect from NodeJS using a private key
   * ```ts
   * const client = await ZKDatabaseClient.connect('zkdb+https://username:EKEGu8rTZbfWE1HWLxWtDnjt8gchvGxYM4s5q3KvNRRfdHBVe6UU@test-serverless.zkdatabase.org/graphql?db=my-db');
   * ```
   * Connect from browser using Auro Wallet
   * ```ts
   * const client = await ZKDatabaseClient.connect('zkdb+https://username@test-serverless.zkdatabase.org/graphql?db=my-db');
   * ```
   * @param url
   * @returns
   */
  public static async connect(url: string): Promise<ZKDatabaseClient> {
    const urlInstance = new URL(url);
    const { password, protocol, host, pathname, searchParams } = urlInstance;
    const [base, abstract] = protocol.replace(':', '').split('+');
    if (base != 'zkdb') {
      throw new Error('Invalid protocol');
    }
    const apiURL = `${abstract}://${host}${pathname}`;
    const db = searchParams.get('db');
    if (!db) {
      throw new Error('Database name is required');
    }
    const apiClient = ApiClient.newInstance(apiURL);
    // Get environment variables
    const envResult = await apiClient.environment.getEnvironment(undefined);
    const { networkId, networkUrl } = envResult.isOne()
      ? envResult.unwrap()
      : {};
    if (isNetwork(networkId) && typeof networkUrl === 'string') {
      if (password === '' || password === 'auro-wallet') {
        const signer = new AuroWalletSigner();
        const authenticator = new Authenticator(
          signer,
          apiClient,
          global.localStorage
        );
        return new ZKDatabaseClient(apiClient, authenticator, {
          networkId,
          networkUrl,
        });
      } else {
        const signer = new NodeSigner(
          PrivateKey.fromBase58(password),
          networkId
        );
        return new ZKDatabaseClient(
          apiClient,
          new Authenticator(signer, apiClient),
          {
            networkId,
            networkUrl,
          }
        );
      }
    }
    throw new Error('Invalid environment');
  }

  public getSigner(): Signer {
    return this.authenticator.signer;
  }

  public setSigner(signer: Signer) {
    this.authenticator.connect(signer);
  }

  db(name: string): ZKDatabase {
    if (this.apiClient) {
      return new ZKDatabaseImpl(name, this.apiClient);
    }
    throw new Error(
      'Database access failed: Server URL is not set. Please call connect() first.'
    );
  }

  get system(): ZKSystem {
    if (this.apiClient) {
      return new ZKSystemImpl(this.apiClient);
    }

    throw new Error(
      'Global access failed: Server URL is not set. Please call connect() first.'
    );
  }
}

export default ZKDatabaseClient;
