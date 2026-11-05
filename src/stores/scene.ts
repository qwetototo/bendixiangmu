import { defineStore } from 'pinia';
import type { SceneConfig } from '@/types/scene';
import { getActiveMap, isLocalDraftMap, setActiveMapId, type SavedMap } from '@/services/mapLibrary';
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
      const localMap = getActiveMap();
      if (isLocalDraftMap(localMap)) {
        this.savedMap = localMap;
        this.activeMapId = localMap.id;
        this.config = localMap.config;
        setPositionTransform(derivePositionTransform(localMap));
        return;
      }
      try {
        const detail = await fetchActiveModel();
        const saved = detail ? mapDetailToSavedMap(detail) : null;
        if (!saved) return;
        this.setActiveMap(saved);
      } catch (error) {
        console.warn('[scene] failed to load active map from server, falling back to local map', error);
      }
    },
    setActiveMap(map: SavedMap) {
      const activeFloor = map.metadata.floors.find((floor) => floor.id === map.metadata.activeFloorId)
        ?? map.metadata.floors.find((floor) => floor.id === map.config.floor.id)
        ?? map.metadata.floors[0];
      const activeMap = activeFloor
        ? {
            ...map,
            config: activeFloor.config,
            metadata: { ...map.metadata, activeFloorId: activeFloor.id },
          }
        : map;

      this.activeMapId = activeMap.id;
      this.config = activeMap.config;
      this.savedMap = activeMap;
      setActiveMapId(activeMap.id);
      setPositionTransform(derivePositionTransform(activeMap, activeFloor?.id ?? activeMap.config.floor.id));
    },
  },
});
