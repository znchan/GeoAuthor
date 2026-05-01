import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

const baseRules = {
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-control-regex': 'off',
  'no-unreachable': 'off',
  'no-useless-assignment': 'off',
  'no-undef': 'off',
  'prefer-const': 'warn',
  'no-var': 'error',
  eqeqeq: ['warn', 'smart'],
};

const vueRules = {
  'vue/multi-word-component-names': 'off',
  'vue/no-v-for-template-key-on-child': 'off',
  'vue/no-v-html': 'off',
  'vue/require-default-prop': 'off',
  'vue/attribute-hyphenation': 'off',
  'vue/v-on-event-hyphenation': 'off',
  'vue/no-unused-vars': ['warn', { ignorePattern: '^_' }],
  'vue/html-self-closing': 'off',
  'vue/max-attributes-per-line': 'off',
  'vue/singleline-html-element-content-newline': 'off',
  'vue/html-indent': 'off',
  'vue/html-closing-bracket-newline': 'off',
  'vue/first-attribute-linebreak': 'off',
  'vue/attributes-order': 'off',
  'vue/no-mutating-props': 'off',
  'vue/no-use-v-if-with-v-for': 'off',
  'vue/no-ref-as-operand': 'warn',
};

export default [
  {
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'gen_data/**',
      'outputs/**',
      'csvs/**',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      ...baseRules,
      ...vueRules,
    },
  },
  {
    // The backend stub file intentionally returns mock data before the live
    // axios branches. The mock blocks document the wire contract and are
    // referenced by docs/backend-contract.md. Keep them as-is.
    files: ['src/utils/BackendMsgs.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
