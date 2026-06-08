import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MODEL_UPLOAD_PATH = '/__twintrack/model-upload';
const MODEL_UPLOAD_LIMIT = 256 * 1024 * 1024;

function sanitizePathSegment(value: string): string {
  return value.replace(/[^\w.-]/g, '_').replace(/^\.+$/, '_');
}

function sanitizeSubdirectory(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map(sanitizePathSegment)
    .join('/');
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MODEL_UPLOAD_LIMIT) {
      throw new Error('模型文件不能超过 256 MB');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function modelUploadMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url !== MODEL_UPLOAD_PATH || request.method !== 'POST') {
    next();
    return;
  }

  void (async () => {
    const encodedFileName = String(request.headers['x-file-name'] || '');
    const encodedSubdirectory = String(request.headers['x-model-directory'] || 'uploads');
    const fileName = sanitizePathSegment(decodeURIComponent(encodedFileName));
    const subdirectory = sanitizeSubdirectory(decodeURIComponent(encodedSubdirectory)) || 'uploads';
    const extension = path.extname(fileName).toLowerCase();

    if (!fileName || !['.glb', '.gltf'].includes(extension)) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '只支持 .glb 或 .gltf 模型文件' }));
      return;
    }

    const body = await readRequestBody(request);
    if (body.length === 0) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '模型文件为空' }));
      return;
    }

    const modelDirectory = path.resolve(__dirname, 'src/assets/model');
    const targetDirectory = path.resolve(modelDirectory, subdirectory);
    if (!targetDirectory.startsWith(`${modelDirectory}${path.sep}`)) {
      throw new Error('模型目录无效');
    }

    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(path.join(targetDirectory, fileName), body);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ path: `${subdirectory}/${fileName}` }));
  })().catch((error: unknown) => {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : '模型保存失败' }));
  });
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'twintrack-model-upload',
      configureServer(server) {
        server.middlewares.use(modelUploadMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(modelUploadMiddleware);
      },
    },
  ],
  assetsInclude: ['**/*.glb'],
  server: {
    host: '0.0.0.0',
    port: 5100,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5100,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
