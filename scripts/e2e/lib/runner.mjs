// Runner mínimo de testes e2e. Sem dependência de Jest/Vitest — só
// `node --env-file=.env.local`. Output visual com cores ANSI, lista
// dos testes que passam/falham e detalhe do erro.
//
// Cada teste é responsável pelo próprio cleanup. O runner registra
// hooks de cleanup defensivos (rodam mesmo se o teste lançar exceção)
// pra garantir que NUNCA fica registro órfão na base.

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

class TestContext {
  constructor() {
    this._cleanups = [];
  }
  /**
   * Registra um cleanup que roda após o teste (mesmo se o teste lançar).
   * Cleanups rodam em ordem reversa (LIFO) — útil pra desfazer cadeia
   * de criação (user → routine → exercise: deleta exercise antes).
   */
  defer(fn) {
    this._cleanups.push(fn);
  }
  async _runCleanups() {
    while (this._cleanups.length) {
      const fn = this._cleanups.pop();
      try {
        await fn();
      } catch (err) {
        console.log(
          `      ${C.yellow}cleanup falhou:${C.reset} ${err?.message ?? err}`,
        );
      }
    }
  }
}

const _suites = [];

/**
 * Define uma suíte (grupo de testes relacionados).
 * Suites são executadas em ordem de registro.
 */
export function suite(name, fn) {
  const tests = [];
  fn({
    test: (testName, testFn) => tests.push({ name: testName, fn: testFn }),
    skip: (testName) =>
      tests.push({ name: testName, fn: null, skip: 'skipped' }),
  });
  _suites.push({ name, tests });
}

export async function runAll({ filter } = {}) {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  const startedAt = Date.now();

  console.log(
    `\n${C.bold}${C.cyan}NutriOn — testes e2e${C.reset}\n${C.dim}base: ${process.env.EXPO_PUBLIC_SUPABASE_URL ?? '(sem url)'}${C.reset}\n`,
  );

  for (const suiteEntry of _suites) {
    if (filter && !suiteEntry.name.toLowerCase().includes(filter.toLowerCase())) {
      continue;
    }
    console.log(`${C.bold}${C.blue}❯ ${suiteEntry.name}${C.reset}`);
    for (const t of suiteEntry.tests) {
      if (t.skip) {
        console.log(`  ${C.gray}○ ${t.name} (pulado)${C.reset}`);
        skipped++;
        continue;
      }
      const ctx = new TestContext();
      const tStart = Date.now();
      let ok = false;
      let errMsg = '';
      try {
        await t.fn(ctx);
        ok = true;
      } catch (err) {
        errMsg = err?.message ?? String(err);
        if (err?.stack) errMsg = err.stack;
      } finally {
        await ctx._runCleanups();
      }
      const duration = Date.now() - tStart;
      if (ok) {
        console.log(
          `  ${C.green}✓${C.reset} ${t.name} ${C.dim}(${duration}ms)${C.reset}`,
        );
        pass++;
      } else {
        console.log(
          `  ${C.red}✗${C.reset} ${t.name} ${C.dim}(${duration}ms)${C.reset}`,
        );
        for (const line of errMsg.split('\n')) {
          console.log(`    ${C.red}${line}${C.reset}`);
        }
        fail++;
        failures.push({ suite: suiteEntry.name, test: t.name, error: errMsg });
      }
    }
    console.log();
  }

  const total = pass + fail + skipped;
  const totalDuration = Date.now() - startedAt;
  const summary = [
    `${C.bold}${total} testes${C.reset}`,
    `${C.green}${pass} passou${C.reset}`,
    fail > 0 ? `${C.red}${fail} falhou${C.reset}` : null,
    skipped > 0 ? `${C.gray}${skipped} pulado${C.reset}` : null,
    `${C.dim}${totalDuration}ms${C.reset}`,
  ]
    .filter(Boolean)
    .join('  ');
  console.log(`${summary}\n`);

  return { pass, fail, skipped, failures };
}

// Helper de asserção minimalista — sem precisar import de assert.
export function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(
          `esperava ${JSON.stringify(expected)}, recebeu ${JSON.stringify(actual)}`,
        );
      }
    },
    toEqual: (expected) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`esperava ${b}, recebeu ${a}`);
    },
    toBeTruthy: () => {
      if (!actual)
        throw new Error(`esperava truthy, recebeu ${JSON.stringify(actual)}`);
    },
    toBeNull: () => {
      if (actual !== null)
        throw new Error(`esperava null, recebeu ${JSON.stringify(actual)}`);
    },
    toBeDefined: () => {
      if (actual === undefined)
        throw new Error(`esperava definido, recebeu undefined`);
    },
    toBeGreaterThan: (n) => {
      if (!(actual > n))
        throw new Error(`esperava > ${n}, recebeu ${actual}`);
    },
    toBeGreaterThanOrEqual: (n) => {
      if (!(actual >= n))
        throw new Error(`esperava >= ${n}, recebeu ${actual}`);
    },
    toContain: (item) => {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(
          `esperava conter ${JSON.stringify(item)}, array: ${JSON.stringify(actual)}`,
        );
      }
    },
  };
}
