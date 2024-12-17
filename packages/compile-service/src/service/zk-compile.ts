import { logger } from "@helper";
import { ZKDatabaseSmartContractWrapper } from "@zkdb/smart-contract";
import { ModelMetadataDatabase } from "@zkdb/storage";
import { fetchAccount, JsonProof, Mina, PrivateKey, PublicKey } from "o1js";

const MAX_MERKLE_TREE_HEIGHT = 128;

export type UnsignedTransaction = string;

export class ZkCompileService {
  private compiledSmartContracts: Array<ZKDatabaseSmartContractWrapper>;

  constructor(
    private readonly network: { networkId: "testnet" | "mainnet"; mina: string }
  ) {
    // Set active network
    Mina.setActiveInstance(Mina.Network(this.network));
    this.compiledSmartContracts = new Array(MAX_MERKLE_TREE_HEIGHT);
  }

  private async getSmartContract(
    merkleHeight: number
  ): Promise<ZKDatabaseSmartContractWrapper> {
    if (!this.compiledSmartContracts[merkleHeight - 1]) {
      const zkWrapper =
        ZKDatabaseSmartContractWrapper.mainConstructor(merkleHeight);
      await zkWrapper.compile();
      this.compiledSmartContracts[merkleHeight - 1] = zkWrapper;
    }

    return this.compiledSmartContracts[merkleHeight - 1];
  }

  async compileAndCreateDeployUnsignTx(
    payerAddress: string,
    zkDbPrivateKey: PrivateKey,
    merkleHeight: number,
    databaseName: string
  ): Promise<UnsignedTransaction> {
    try {
      this.ensureTransaction();

      const zkDbPublicKey = PublicKey.fromPrivateKey(zkDbPrivateKey);
      const senderPublicKey = PublicKey.fromBase58(payerAddress);

      await Promise.all([
        await fetchAccount({
          publicKey: senderPublicKey,
        }),
      ]);

      const start = performance.now();

      const zkWrapper = await this.getSmartContract(merkleHeight);

      const unsignedTx = await zkWrapper.createAndProveDeployTransaction({
        sender: senderPublicKey,
        zkApp: zkDbPublicKey,
      });

      const partialSignedTx = unsignedTx.sign([zkDbPrivateKey]);
      await ModelMetadataDatabase.getInstance().updateOne(
        { databaseName },
        {
          appPublicKey: zkDbPublicKey.toBase58(),
        }
      );

      const end = performance.now();
      logger.info(
        `Deploy ${zkDbPublicKey.toBase58()} take ${(end - start) / 1000}s`
      );

      return partialSignedTx.toJSON();
    } catch (error) {
      logger.error(`Can not compile & deploy: ${databaseName}`);
      await ModelMetadataDatabase.getInstance().updateOne(
        { databaseName },
        {
          appPublicKey: undefined,
        }
      );
      throw error;
    }
  }

  async compileAndCreateRollUpUnsignTx(
    payerAddress: string,
    zkDbPrivateKey: PrivateKey,
    merkleHeight: number,
    proof: JsonProof
  ): Promise<UnsignedTransaction> {
    this.ensureTransaction();

    const zkDbPublicKey = PublicKey.fromPrivateKey(zkDbPrivateKey);
    const senderPublicKey = PublicKey.fromBase58(payerAddress);

    await Promise.all([
      await fetchAccount({
        publicKey: zkDbPublicKey,
      }),
      await fetchAccount({
        publicKey: senderPublicKey,
      }),
    ]);

    const start = performance.now();

    const zkWrapper = await this.getSmartContract(merkleHeight);

    const unsignedTx = await zkWrapper.createAndProveRollUpTransaction(
      {
        sender: senderPublicKey,
        zkApp: zkDbPublicKey,
      },
      proof
    );

    const partialSignedTx = unsignedTx.sign([zkDbPrivateKey]);
    const end = performance.now();
    logger.info(
      `Roll-up ${zkDbPublicKey.toBase58()} take ${(end - start) / 1000}s`
    );

    return partialSignedTx.toJSON();
  }

  private ensureTransaction() {
    if (Mina.currentTransaction.has()) {
      logger.debug(
        `${Mina.currentTransaction.get()}, data: ${Mina.currentTransaction.data}`
      );
      throw Error("Transaction within transaction identified");
    }
  }
}
