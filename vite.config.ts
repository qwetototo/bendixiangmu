import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_UPLOAD_PATH = '/__twintrack/model-upload';
const THUMBNAIL_UPLOAD_PATH = '/__twintrack/thumbnail-upload';
const FILE_DELETE_PATH = '/__twintrack/file-delete';
const MODEL_UPLOAD_LIMIT = 256 * 1024 * 1024;
const THUMBNAIL_UPLOAD_LIMIT = 12 * 1024 * 1024;
const UPLOAD_BASE_DIR = path.resolve(__dirname, 'public/twintrack');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

function sanitizeSubdirectory(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .map((s) => s.replace(/[^\w.-]/g, '_').replace(/^\.+$/, '_'))
    .join('/');
}

async function readRequestBody(request: IncomingMessage, limit = MODEL_UPLOAD_LIMIT): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) {
      throw new Error(limit === THUMBNAIL_UPLOAD_LIMIT ? '缩略图不能超过 12 MB' : '模型文件不能超过 256 MB');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function thumbnailUploadMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url !== THUMBNAIL_UPLOAD_PATH || request.method !== 'POST') {
    next();
    return;
  }

  void (async () => {
    const rawFileName = decodeURIComponent(String(request.headers['x-file-name'] || '') || '');
    const extension = path.extname(rawFileName).toLowerCase();

    if (!rawFileName || !['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '只支持 .png、.jpg、.jpeg 或 .webp 缩略图' }));
      return;
    }

    const body = await readRequestBody(request, THUMBNAIL_UPLOAD_LIMIT);
    if (body.length === 0) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '缩略图文件为空' }));
      return;
    }

    const uuidName = `${randomUUID()}${extension}`;
    const thumbnailDirectory = path.resolve(UPLOAD_BASE_DIR, 'thumbnails');
    await fs.mkdir(thumbnailDirectory, { recursive: true });
    await fs.writeFile(path.join(thumbnailDirectory, uuidName), body);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ path: `/twintrack/thumbnails/${uuidName}` }));
  })().catch((error: unknown) => {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : '缩略图保存失败' }));
  });
}

function fileDeleteMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url !== FILE_DELETE_PATH || request.method !== 'DELETE') {
    next();
    return;
  }

  void (async () => {
    const rawFilePath = decodeURIComponent(String(request.headers['x-file-path'] || '') || '');
    if (!rawFilePath) {
      response.statusCode = 400;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '文件路径不能为空' }));
      return;
    }

    // Resolve the URL path relative to the public directory
    const cleanPath = rawFilePath.replace(/^\//, '');
    const resolvedPath = path.resolve(PUBLIC_DIR, cleanPath);

    // Security: only allow deletion of files under the upload base directory
    if (!resolvedPath.startsWith(UPLOAD_BASE_DIR)) {
      response.statusCode = 403;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: '不允许删除该路径的文件' }));
      return;
    }

    try {
      await fs.unlink(resolvedPath);
    } catch {
      // File already gone — still report success since the goal is cleanup
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ success: true }));
  })().catch((error: unknown) => {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : '文件删除失败' }));
  });
}

function modelUploadMiddleware(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url !== MODEL_UPLOAD_PATH || request.method !== 'POST') {
    next();
    return;
  }

  void (async () => {
    const rawFileName = decodeURIComponent(String(request.headers['x-file-name'] || '') || '');
    const rawSubdirectory = decodeURIComponent(String(request.headers['x-model-directory'] || 'uploads') || '');
    const subdirectory = sanitizeSubdirectory(rawSubdirectory) || 'uploads';
    const extension = path.extname(rawFileName).toLowerCase();

    if (!rawFileName || !['.glb', '.gltf'].includes(extension)) {
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

    const modelDirectory = path.resolve(UPLOAD_BASE_DIR, 'models');
    const targetDirectory = path.resolve(modelDirectory, subdirectory);
    if (!targetDirectory.startsWith(`${modelDirectory}${path.sep}`)) {
      throw new Error('模型目录无效');
    }

    const uuidName = `${randomUUID()}${extension}`;
    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(path.join(targetDirectory, uuidName), body);

    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ path: `/twintrack/models/${subdirectory}/${uuidName}` }));
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
        server.middlewares.use(fileDeleteMiddleware);
        server.middlewares.use(modelUploadMiddleware);
        server.middlewares.use(thumbnailUploadMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(fileDeleteMiddleware);
        server.middlewares.use(modelUploadMiddleware);
        server.middlewares.use(thumbnailUploadMiddleware);
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
