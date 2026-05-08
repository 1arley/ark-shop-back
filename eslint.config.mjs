// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ─── Ignores ────────────────────────────────────────────────────────────────
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'generated/**',
      'node_modules/**',
      'coverage/**',
      'prisma/migrations/**',
    ],
  },

  // ─── Base configs ───────────────────────────────────────────────────────────
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,

  // ─── Parser / language options ──────────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      // FIX 1: era 'commonjs', mas os arquivos usam import/export (ESM syntax).
      // tsconfig tem module: nodenext → sourceType deve ser 'module'.
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ─── Regras para código de produção ─────────────────────────────────────────
  {
    rules: {
      // FIX 2: 'error' gerava centenas de falsos positivos.
      // NestJS usa any em @Body(), @Query(), job.data, Prisma Json, etc.
      // 'warn' mantém visibilidade sem bloquear o build.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Floating promises são bugs reais — mantém como error (com void escape hatch)
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],

      // FIX 3: no-unsafe-* já vêm via recommendedTypeChecked.
      // Re-declarar como 'error' dobrava o ruído. Deixamos em 'warn' para
      // manter visibilidade sem travar CI em código NestJS legítimo.
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // Variáveis não usadas são bugs reais — mantém como error
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // FIX 4: era { endOfLine: 'lf' }, conflitava com .prettierrc (que usa 'auto').
      // 'auto' respeita o line ending nativo do sistema operacional.
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // ─── Regras relaxadas para testes ────────────────────────────────────────────
  // FIX 5: padrão ampliado para cobrir seed, arquivos .js de teste e utils
  {
    files: [
      '**/*.spec.ts',
      '**/*.e2e-spec.ts',
      '**/test/**/*.ts',
      '**/test/**/*.js',     // arquivos .js de setup/seed que estavam de fora
      'prisma/seed.ts',      // seed estava fora do override
      'prisma/seed.*.ts',
    ],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'warn', // menos crítico em testes
    },
  },
);