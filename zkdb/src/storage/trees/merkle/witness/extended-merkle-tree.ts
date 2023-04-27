import { MerkleWitness, Field, Circuit, Poseidon } from 'snarkyjs';

/**
 * Factory function to create an ExtendedMerkleWitness class with a given height.
 * The ExtendedMerkleWitness class extends the BaseWitness class and provides an
 * additional method, `calculatePath`, to compute the Merkle path for a given leaf
 * in the tree.
 *
 * @param height The height of the Merkle tree.
 * @returns ExtendedMerkleWitness class with the specified height.
 */

export function createExtendedMerkleWitness(height: number): any {
  const BaseWitness = MerkleWitness(height);

  class ExtendedMerkleWitness extends BaseWitness {
    calculatePath(leaf: Field): Field[] {
      const path: Field[] = leaf.toFields();

      const n = this.height();

      for (let i = 1; i < n; ++i) {
        const left = Circuit.if(
          this.isLeft[i - 1],
          path[path.length - 1],
          this.path[i - 1]
        );
        const right = Circuit.if(
          this.isLeft[i - 1],
          this.path[i - 1],
          path[path.length - 1]
        );
        const hash = Poseidon.hash([left, right]);
        path.push(hash);
      }

      return path;
    }
  }

  return ExtendedMerkleWitness as any;
}
