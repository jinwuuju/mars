import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'dist-single/**', 'node_modules/**', 'docs/**', 'design/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 구조적 격리: 측정 모듈은 이야기 상태(승선 명단, 플래그, 소지품)와 화면 코드를 import할 수 없다.
    files: ['src/analytics/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/core/**', '**/story/**', '**/ui/**', '**/world/**', '**/art/**', '**/game/**'],
          message: '측정 모듈은 승선 명단·이야기 플래그·화면 코드에 접근할 수 없습니다 (SCIENCE_AND_ETHICS).',
        }],
      }],
    },
  },
];
