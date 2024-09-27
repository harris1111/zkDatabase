/* eslint-disable no-unused-vars */

import { ProofStatus, MerkleWitness } from '../../types';
import { DocumentEncoded } from '../schema.js';
import { Ownable } from './ownable.js';

export interface ZKDocument extends Ownable {
  getId(): string;
  getDocumentEncoded(): DocumentEncoded;
  getWitness(): Promise<MerkleWitness>;
  delete(): Promise<MerkleWitness>;
  getCreatedAt(): Date;
  toSchema<
    T extends {
      new (..._args: any): InstanceType<T>;
      deserialize: (_doc: DocumentEncoded) => any;
    },
  >(
    type: T
  ): InstanceType<T>;
  getProofStatus(): Promise<ProofStatus>;
  getDocumentHistory(): Promise<ZKDocument[]>;
}
