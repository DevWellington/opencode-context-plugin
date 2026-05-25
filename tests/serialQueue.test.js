/**
 * Serial Queue Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { withSerialQueue, withKeyedQueue, clearKeyedQueues } from '../src/utils/serialQueue.js';

describe('withSerialQueue', () => {
  beforeEach(() => {
    clearKeyedQueues();
  });

  it('executes functions in order', async () => {
    const order = [];
    await Promise.all([
      withSerialQueue(() => { order.push(1); }),
      withSerialQueue(() => { order.push(2); }),
      withSerialQueue(() => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('waits for previous function to complete before starting next', async () => {
    const startOrder = [];
    await Promise.all([
      withSerialQueue(async () => {
        startOrder.push('start 1');
        await new Promise(r => setTimeout(r, 50));
        startOrder.push('end 1');
      }),
      withSerialQueue(async () => {
        startOrder.push('start 2');
      }),
    ]);
    expect(startOrder).toEqual(['start 1', 'end 1', 'start 2']);
  });

  it('handles rejection in one function without blocking queued functions', async () => {
    const order = [];
    await expect(Promise.all([
      withSerialQueue(async () => {
        order.push(1);
        throw new Error('fail');
      }),
      withSerialQueue(async () => {
        order.push(2);
      }),
    ])).rejects.toThrow('fail');
    expect(order).toEqual([1, 2]);
  });

  it('throws on null/undefined fn', async () => {
    await expect(withSerialQueue(null)).rejects.toThrow();
    await expect(withSerialQueue(undefined)).rejects.toThrow();
  });

  it('handles nested calls with different queues using keyed queue', async () => {
    const order = [];
    await withKeyedQueue('outer', async () => {
      order.push('outer start');
      await withKeyedQueue('inner', async () => {
        order.push('inner');
      });
      order.push('outer end');
    });
    expect(order).toEqual(['outer start', 'inner', 'outer end']);
  });
});

describe('withKeyedQueue', () => {
  beforeEach(() => {
    clearKeyedQueues();
  });

  it('uses separate queues per key', async () => {
    const order = { a: [], b: [] };
    await Promise.all([
      withKeyedQueue('a', async () => {
        await new Promise(r => setTimeout(r, 30));
        order.a.push(1);
      }),
      withKeyedQueue('a', async () => {
        order.a.push(2);
      }),
      withKeyedQueue('b', async () => {
        order.b.push(1);
      }),
      withKeyedQueue('b', async () => {
        order.b.push(2);
      }),
    ]);
    expect(order.a).toEqual([1, 2]);
    expect(order.b).toEqual([1, 2]);
  });

  it('handles concurrent operations with different keys', async () => {
    const startOrder = [];
    const done = [];
    await Promise.all([
      withKeyedQueue('x', async () => {
        startOrder.push('x start');
        await new Promise(r => setTimeout(r, 30));
        done.push('x done');
      }),
      withKeyedQueue('y', async () => {
        startOrder.push('y start');
        await new Promise(r => setTimeout(r, 10));
        done.push('y done');
      }),
    ]);
    expect(startOrder).toContain('x start');
    expect(startOrder).toContain('y start');
    expect(done).toContain('x done');
    expect(done).toContain('y done');
  });

  it('throws on null/undefined fn', async () => {
    await expect(withKeyedQueue('k', null)).rejects.toThrow();
    await expect(withKeyedQueue('k', undefined)).rejects.toThrow();
  });
});

describe('clearKeyedQueues', () => {
  beforeEach(() => {
    clearKeyedQueues();
  });

  it('resets all queues', async () => {
    const order = [];
    const p1 = withKeyedQueue('a', async () => {
      await new Promise(r => setTimeout(r, 20));
      order.push(1);
    });
    clearKeyedQueues();
    await withKeyedQueue('a', async () => {
      order.push(2);
    });
    await p1;
    expect(order).toEqual([2, 1]);
  });
});
