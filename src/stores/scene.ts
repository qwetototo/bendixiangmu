import { defineStore } from 'pinia';
import type { SceneConfig } from '@/types/scene';
import { getActiveMap, getMapLibrary, setActiveMapId, type SavedMap } from '@/services/mapLibrary';
import { fetchActiveModel, mapDetailToSavedMap } from '@/services/mapApi';
import { derivePositionTransform, setPositionTransform } from '@/services/positionTransform';

interface SceneState {
  config: SceneConfig;
  activeMapId: string;
  savedMap: SavedMap | null;
}

export const useSceneStore = defineStore('scene', {
  state: (): SceneState => {
    const activeMap = getActiveMap();
    setPositionTransform(derivePositionTransform(activeMap));
    return {
      config: activeMap.config,
      activeMapId: activeMap.id,
      savedMap: activeMap,
    };
  },
  actions: {
    setConfig(config: SceneConfig) {
      this.config = config;
    },
    /**
     * 从服务端拉取"当前应用的地图"并覆盖本地配置。
     * 服务端无 active 地图或后端不可用时，保留 localStorage 默认行为。
     */
    async initialize() {
      try {
        const detail = await fetchActiveModel();
        const saved = detail ? mapDetailToSavedMap(detail) : null;
        if (!saved) return;
        this.savedMap = saved;
        this.activeMapId = saved.id;
        this.config = saved.config;
        setActiveMapId(saved.id);
        setPositionTransform(derivePositionTransform(saved));
      } catch (error) {
        console.warn('[scene] failed to load active map from server, falling back to local map', error);
      }
    },
    setActiveMap(mapId: string, config: SceneConfig) {
      this.activeMapId = mapId;
      this.config = config;
      setActiveMapId(mapId);
      const map = getMapLibrary().find((item) => item.id === mapId);
      if (map) {
        this.savedMap = map;
        setPositionTransform(derivePositionTransform(map));
      }
    },
  },
});
