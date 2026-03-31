import { expect as baseExpect, test } from '@playwright/test';
import { extendExpect } from './toHaveState';

export const expect = extendExpect(baseExpect);
export { test };
