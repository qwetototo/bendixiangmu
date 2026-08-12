import * as THREE from 'three';

/**
 * 上传模型资产的 URL 版本缓存。
 *
 * 后端用同一 upload id 重传会覆盖同名 `/uploads/models/{id}.glb`（URL 不变），
 * 而 THREE.Cache（全局开启）与浏览器 HTTP 缓存都会按 URL 命中旧内容，导致
 * 「更换地图」后预览/主屏仍显示旧模型。这里维护每个路径的重传版本号，在 URL
 * 后附加 `?v=N` 查询串，使重载必然绕过缓存。
 */
const uploadedModelVersions = new Map<string, number>();

/** 返回带版本号的加载 URL；未重传过的路径原样返回，不影响现有行为。 */
export function versionModelAssetUrl(path: string): string {
  const version = uploadedModelVersions.get(path);
  return version ? `${path}?v=${version}` : path;
}

/** 标记某路径已重传：版本自增，并清掉 THREE.Cache 里的旧条目。 */
export function invalidateModelAssetUrl(path: string): void {
  const version = (uploadedModelVersions.get(path) ?? 0) + 1;
  uploadedModelVersions.set(path, version);
  THREE.Cache.remove(path);
  THREE.Cache.remove(`${path}?v=${version}`);
}
