import { expect as baseExpect, type ExpectMatcherState } from '@playwright/test';

type Predicate<T> = (value: T) => boolean;
type ExpectedState = Record<string, unknown>;
type QueryEntry = readonly [key: string, expectedValue: unknown, query: () => Promise<unknown>];

export interface ToHaveStateOptions {
  timeout?: number;
  stableFor?: number;
}

export type AsyncQueryKeys<T> = T extends object ? {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
    ? A extends []
      ? R extends void
        ? never
        : R extends (...args: unknown[]) => unknown
          ? never
          : K
      : never
    : never;
}[keyof T] : never;

export type StateOf<T> = T extends object ? {
  [K in AsyncQueryKeys<T>]?: T[K] extends () => Promise<infer R>
    ? R | Predicate<R>
    : never;
} : never;

export interface ToHaveStateMatcher<T> {
  toHaveState(
    expected: StateOf<NonNullable<T>>,
    options?: ToHaveStateOptions,
  ): Promise<void>;
  not: ReturnType<typeof baseExpect<T>>['not'] & {
    toHaveState(
      expected: StateOf<NonNullable<T>>,
      options?: ToHaveStateOptions,
    ): Promise<void>;
  };
}

interface ExpectCallSignature {
  <T extends unknown[]>(actual: T): ReturnType<typeof baseExpect<T>>;
  <T>(actual: T): ReturnType<typeof baseExpect<T>> & ToHaveStateMatcher<T>;
}

type BaseExpectStatics = Omit<typeof baseExpect, 'configure' | 'soft'>;

export type ExtendedExpect = ExpectCallSignature & BaseExpectStatics & {
  configure(configuration: Parameters<typeof baseExpect.configure>[0]): ExtendedExpect;
  soft: ExtendedExpect;
};
export type ToHaveStateMatchers = typeof toHaveStateMatchers;

declare const receiverBrand: unique symbol;

interface StateReceiver {
  [receiverBrand]: unknown;
}

function isPredicate(value: unknown): value is Predicate<unknown> {
  return typeof value === 'function';
}

function normalizeExpected(expected: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(expected)) {
    normalized[key] = isPredicate(value) ? value.toString() : value;
  }

  return normalized;
}

function resolveQueries(received: StateReceiver, expected: ExpectedState): QueryEntry[] {
  return Object.entries(expected).map(([key, expectedValue]) => {
    const query = (received as unknown as Record<string, unknown>)[key];
    if (typeof query !== 'function') {
      throw new Error(`toHaveState: "${key}" is not a method on the received object`);
    }

    return [key, expectedValue, query as () => Promise<unknown>];
  });
}

async function readActualState(received: StateReceiver, queries: readonly QueryEntry[]): Promise<ExpectedState> {
  const actualState: ExpectedState = {};

  for (const [key, expectedValue, query] of queries) {
    const actualValue = await query.call(received);
    actualState[key] = isPredicate(expectedValue)
      ? expectedValue(actualValue) ? expectedValue.toString() : actualValue
      : actualValue;
  }

  return actualState;
}

function statesMatch(actual: ExpectedState, expected: ExpectedState): boolean {
  try {
    baseExpect(actual).toEqual(expected);
    return true;
  } catch {
    return false;
  }
}

function createMismatchMessage(actual: ExpectedState, expected: ExpectedState): string {
  try {
    baseExpect(actual).toEqual(expected);
    return 'State matched';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function createStabilityMessage(
  utils: ExpectMatcherState['utils'],
  expand: boolean,
  actual: ExpectedState,
  expected: ExpectedState,
  stableFor: number,
  timeout: number,
): string {
  const matcherHint = utils.matcherHint('toHaveState', 'received', 'expected');
  const diff = (utils as ExpectMatcherState['utils'] & {
    printDiffOrStringify?: (
      expected: unknown,
      received: unknown,
      expectedLabel: string,
      receivedLabel: string,
      expand: boolean,
    ) => string,
  }).printDiffOrStringify?.(
    expected,
    actual,
    'Expected state',
    'Last matched state',
    expand,
  );

  return [
    matcherHint,
    '',
    `State matched, but did not remain stable for ${stableFor}ms within ${timeout}ms.`,
    ...(diff ? ['', diff] : [
      '',
      'Expected state:',
      `  ${utils.printExpected(expected)}`,
      '',
      'Last matched state:',
      `  ${utils.printReceived(actual)}`,
    ]),
  ].join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const toHaveStateMatchers = {
  async toHaveState(
    this: ExpectMatcherState,
    received: StateReceiver,
    expected: ExpectedState,
    options?: ToHaveStateOptions,
  ) {
    const normalizedExpected = normalizeExpected(expected ?? {});
    const timeout = options?.timeout ?? (typeof this.timeout === 'number' ? this.timeout : 5_000);
    const stableFor = options?.stableFor ?? 0;

    if (Object.keys(normalizedExpected).length === 0) {
      return {
        pass: true,
        message: () => '',
      };
    }

    try {
      const queries = resolveQueries(received, expected);
      const deadline = Date.now() + timeout;
      let stableSince: number | null = null;
      let lastActualState: ExpectedState = {};

      while (Date.now() <= deadline) {
        lastActualState = await readActualState(received, queries);

        if (!statesMatch(lastActualState, normalizedExpected)) {
          stableSince = null;
          await sleep(25);
          continue;
        }

        if (stableFor <= 0) {
          return {
            pass: true,
            message: () => '',
          };
        }

        const now = Date.now();
        if (stableSince === null) {
          stableSince = now;
        }

        if (now - stableSince >= stableFor) {
          return {
            pass: true,
            message: () => '',
          };
        }

        await sleep(25);
      }

      return {
        pass: false,
        message: () => stableSince !== null
          ? createStabilityMessage(
            this.utils,
            (this as ExpectMatcherState & { expand?: boolean }).expand !== false,
            lastActualState,
            normalizedExpected,
            stableFor,
            timeout,
          )
          : createMismatchMessage(lastActualState, normalizedExpected),
      };
    } catch (error) {
      return {
        pass: false,
        message: () => error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export function extendExpect(expect: typeof baseExpect): ExtendedExpect {
  return expect.extend(toHaveStateMatchers) as unknown as ExtendedExpect;
}
