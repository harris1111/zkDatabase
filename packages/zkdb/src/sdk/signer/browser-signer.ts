import { PrivateKey } from 'o1js';
import { MinaTransaction } from '../types/o1js';
import { Signer } from './interface/signer';
import { SignedData } from '@types';
import { AuroWallet } from '../wallet/auro-wallet';

export class AuroWalletSigner implements Signer {
  async signTransaction(
    transaction: MinaTransaction,
    otherKeys: PrivateKey[]
  ): Promise<MinaTransaction> {
    transaction.sign(otherKeys);
    return AuroWallet.signTransaction(transaction);
  }

  async signMessage(message: string): Promise<SignedData> {
    return AuroWallet.signMessage(message);
  }
}
