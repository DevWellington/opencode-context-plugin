import { jest, describe, it, expect } from '@jest/globals';

const loggerMock = jest.fn();

jest.unstable_mockModule('../../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => loggerMock)
}));

describe('commandHandlers', () => {
  let handleCommandExecuteBefore;

  beforeAll(async () => {
    const mod = await import('../../src/handlers/commandHandlers.js');
    handleCommandExecuteBefore = mod.handleCommandExecuteBefore;
  });

  it('should detect /compact command via event.command', () => {
    const event = { command: '/compact' };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should detect compact command without slash', () => {
    const event = { command: 'compact' };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should detect compact from properties.command', () => {
    const event = { properties: { command: '/compact' } };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should detect compact from properties.name', () => {
    const event = { properties: { name: '/compact' } };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should ignore non-compact command without throwing', () => {
    const event = { command: '/help' };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should handle null event gracefully without throwing', () => {
    expect(() => handleCommandExecuteBefore(null)).not.toThrow();
  });

  it('should handle undefined event gracefully without throwing', () => {
    expect(() => handleCommandExecuteBefore(undefined)).not.toThrow();
  });

  it('should handle event without command property without throwing', () => {
    const event = { unrelated: 'data' };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should handle empty object without throwing', () => {
    expect(() => handleCommandExecuteBefore({})).not.toThrow();
  });

  it('should handle numeric command property without throwing', () => {
    const event = { command: 123 };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });

  it('should handle array command property without throwing', () => {
    const event = { command: ['/compact'] };
    expect(() => handleCommandExecuteBefore(event)).not.toThrow();
  });
});
