# Run and Verify

Run the newly created test and iterate until it passes.

## Run strategy

1. **First run** — headless, default configuration:
   ```bash
   pnpm test playwright/e2e/<spec-file>
   ```
   Read the terminal error output. Most failures (wrong selectors, missing methods, assertion mismatches) are diagnosable from the error message and stack trace alone.

2. **On locator or timing failures** — re-run with tracing enabled:
   ```bash
   npx playwright test playwright/e2e/<spec-file> --trace on
   ```
   This captures screenshots, DOM snapshots, console logs, and network requests at every step. The trace is saved alongside the test results and can help diagnose why a locator didn't match or a state assertion timed out.

3. **If the failure is still unclear** — suggest the user open the trace viewer:
   ```bash
   npx playwright show-trace test-results/<trace-zip>
   ```
   Or open the HTML report:
   ```bash
   npx playwright show-report
   ```

## Fix loop

1. Read the error output carefully.
2. Fix the issue in the POM internals or the test spec.
3. **Never change the POM's public API** — action method signatures, query method names, and child accessors must stay the same. Internal locators, selectors, or test logic may be adjusted.
4. Re-run the test.
5. Repeat until the test passes or the issue requires user input.

## What can be fixed

- Locator selectors that don't match the actual DOM
- Timing issues (add `stableFor` to `toHaveState` assertions, increase `timeout`)
- Wrong locator strategy (e.g., switching from `getByRole` to `getByTestId`)
- Missing `await` or incorrect async handling

## What should not be changed

- Public method names and signatures on POM classes
- The overall test structure (sequence of actions and assertions)
- Adding interactions that were not part of the recorded session
