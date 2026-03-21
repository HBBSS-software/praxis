import { expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('旧前端已迁移到 frontend-legacy，新前端使用 Vite 入口', () => {
  expect(fs.existsSync(path.join(rootDir, 'frontend-legacy/login.html'))).toBe(true);
  expect(read('frontend/index.html')).toContain('/src/main.tsx');
  expect(read('frontend/vite.config.ts')).toContain("defineConfig");
});

test('React 前端继续调用原有后端接口', () => {
  const expectations: Array<{ file: string; snippets: string[] }> = [
    {
      file: 'frontend/src/lib/types.ts',
      snippets: ["export const API_URL = 'http://localhost:3000/api';"]
    },
    {
      file: 'frontend/src/features/auth-page.tsx',
      snippets: ['login(uid.trim(), password)', 'signIn(data.token, data.user)']
    },
    {
      file: 'frontend/src/features/student-pages.tsx',
      snippets: [
        "'/student/records'",
        "'/student/notifications'",
        "'/auth/password'",
        'uploadImage(selectedImage, token)'
      ]
    },
    {
      file: 'frontend/src/features/teacher-pages.tsx',
      snippets: [
        "'/teacher/students'",
        '`/teacher/records',
        "'/teacher/statistics'",
        "'/teacher/records/batch-review'"
      ]
    },
    {
      file: 'frontend/src/features/admin-pages.tsx',
      snippets: [
        "'/admin/users'",
        "'/admin/users/import'",
        "'/admin/assignments'"
      ]
    }
  ];

  for (const expectation of expectations) {
    const source = read(expectation.file);
    for (const snippet of expectation.snippets) {
      expect(source.includes(snippet), `${expectation.file} should include ${snippet}`).toBe(true);
    }
  }
});

test('前端构建产物会输出到 frontend/dist', () => {
  const outputs = ['frontend/dist/index.html'];
  for (const output of outputs) {
    const filePath = path.join(rootDir, output);
    expect(fs.existsSync(filePath), `${output} should exist after build`).toBe(true);
    expect(read(output).length > 0, `${output} should not be empty`).toBe(true);
  }
});
