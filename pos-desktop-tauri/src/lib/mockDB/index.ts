import { executeMockQuery } from './Execute';
import { selectMockQuery } from './select';
import { resetMockStorage } from './storage';

/**
 * Initializes and returns a mock Database connection with execute and select capability.
 * This simulates the Tauri Sqlite plugin in browser environments.
 */
export const createMockDB = () => {
  return {
    execute: executeMockQuery,
    select: selectMockQuery,
  };
};

export { resetMockStorage };
