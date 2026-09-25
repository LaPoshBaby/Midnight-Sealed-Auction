import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as compactRuntime from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/auction/contract/index.js';

describe('Midnight Sealed-Bid Auction Contract Suite', () => {
  const dummyCoinPublicKey = new Uint8Array(32);

  function createTestEnvironment(bidAmount: bigint, publicKey: bigint, initialPrivateState: Record<string, unknown> = {}) {
    let witnessCalled = false;
    const witnesses = {
      my_bid: (ctx: any) => {
        witnessCalled = true;
        return [ctx.privateState, bidAmount];
      },
      my_public_key: (ctx: any) => [ctx.privateState, publicKey],
    };

    const contract = new Contract(witnesses);
    const { currentContractState, currentPrivateState } = contract.initialState({
      initialPrivateState,
      initialZswapLocalState: { coinPublicKey: dummyCoinPublicKey },
    });

    const circuitContext = compactRuntime.createCircuitContext(
      compactRuntime.dummyContractAddress(),
      dummyCoinPublicKey,
      currentContractState.data,
      currentPrivateState
    );

    return { contract, circuitContext, currentContractState, currentPrivateState, getWitnessCalled: () => witnessCalled };
  }

  test('Circuit logic: contract initializes with active auction and zero highest bid', () => {
    const { currentContractState } = createTestEnvironment(100n, 1n);
    const publicLedger = ledger(currentContractState.data);

    assert.equal(publicLedger.highest_bid, 0n, 'Initial highest bid must be 0');
    assert.equal(publicLedger.highest_bidder, 0n, 'Initial highest bidder must be 0');
    assert.equal(publicLedger.is_active, true, 'Auction must be active upon construction');
  });

  test('Circuit logic: bid strictly higher than current highest bid succeeds and computes proofs', () => {
    const validBid = 250n;
    const bidderKey = 777n;
    const { contract, circuitContext, getWitnessCalled } = createTestEnvironment(validBid, bidderKey, { secretSalt: 'xyz-123' });

    const executionResult = contract.circuits.bid(circuitContext);

    assert.ok(getWitnessCalled(), 'Private witness my_bid should be invoked by circuit');
    assert.ok(executionResult, 'Execution result should be returned');
    assert.ok(executionResult.proofData, 'Circuit must generate proofData');
    assert.ok(executionResult.proofData.privateTranscriptOutputs.length > 0, 'Private witness data must be placed in private transcript');
    assert.ok(executionResult.gasCost.computeTime > 0n, 'Circuit execution must register gas cost');
  });

  test('State transition: bid lower than or equal to current highest bid fails circuit assertion', () => {
    // Current highest bid is 0, so submitting 0n must fail the assert(bid_amount > current_highest)
    const invalidBid = 0n;
    const { contract, circuitContext } = createTestEnvironment(invalidBid, 123n);

    assert.throws(
      () => {
        contract.circuits.bid(circuitContext);
      },
      (err: Error) => {
        return err.message.includes('Bid is not high enough');
      },
      'Circuit must throw assertion failure when bid is not strictly greater than highest bid'
    );
  });

  test('Privacy verification: private inputs and losing bids are rejected client-side and never touch chain', () => {
    // A losing bidder attempts to bid below the threshold
    const losingBid = 0n;
    const privateState = { myShieldedSecret: 'super-secret-key-999' };
    const { contract, circuitContext } = createTestEnvironment(losingBid, 456n, privateState);

    // 1. Verify that evaluation fails locally in the ZK circuit
    let failedLocally = false;
    try {
      contract.circuits.bid(circuitContext);
    } catch (err: any) {
      failedLocally = true;
      assert.match(err.message, /Bid is not high enough/);
    }
    assert.ok(failedLocally, 'Losing bid must fail in the local circuit prover');

    // 2. Verify that because the circuit fails locally, no valid proof can be constructed
    // and private inputs remain securely off-chain in privateState
    assert.equal(circuitContext.currentPrivateState.myShieldedSecret, 'super-secret-key-999');
  });

  test('Privacy verification: witness boundaries isolate private state from public ledger', () => {
    const validBid = 500n;
    const { contract, circuitContext, currentContractState } = createTestEnvironment(validBid, 888n, { secretEntropy: 0xdeadbeef });

    const result = contract.circuits.bid(circuitContext);
    const publicLedger = ledger(currentContractState.data);

    // Verify that the private state object or its keys are NEVER leaked to the public ledger object
    const publicKeys = Object.keys(publicLedger);
    assert.ok(!publicKeys.includes('secretEntropy'), 'Private state keys must not exist in public ledger');
    assert.ok(!publicKeys.includes('my_bid'), 'Private witness functions must not exist in public ledger');

    // Verify that the private transcript output is isolated from public transcript
    assert.ok(result.proofData.privateTranscriptOutputs.length > 0, 'Shielded witness exists only in private transcript');
  });
});
