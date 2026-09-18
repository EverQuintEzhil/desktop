import { setupServer } from 'msw/node';

import { defaultHandlers } from './handlers';

/**
 * Shared MSW server for the jsdom suite. Started once in `src/test/setup.ts`;
 * per-test handlers go through `server.use(...)` and are reset after each test.
 */
export const server = setupServer(...defaultHandlers);
