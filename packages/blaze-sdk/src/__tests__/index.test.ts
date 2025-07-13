import { describe, it, expect } from "vitest";
import { recoverMultihopSigner } from "../solvers";

describe("@charisma/blaze", () => {
  it('should recover a signer from a multihop swap', async () => {
    const signer = await recoverMultihopSigner(
      '10dc2024afb6a6f51b4b848031009cbc9d8b710942d392203f2bbd2a59e13aa02f5ecaa0665fee912c36129ca6db759c5b6632d1e219feed833782c7fb9d179201',
      '0310c7f6-dee5-4bec-aab8-6836c2a26356',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
      1000000
    );
    console.log(signer);
    expect(signer).toBeDefined();
  });
});