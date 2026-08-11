import { defineStore } from 'pinia';
import type { SceneConfig } from '@/types/scene';
import { getActiveMap, getMapLibrary, setActiveMapId } from '@/services/mapLibrary';
import { derivePositionTransform, setPositionTransform } from '@/services/positionTransform';

interface SceneState {
  config: SceneConfig;
  activeMapId: string;
}

export const useSceneStore = defineStore('scene', {
  state: (): SceneState => {
    const activeMap = getActiveMap();
    setPositionTransform(derivePositionTransform(activeMap));
    return {
      config: activeMap.config,
      activeMapId: activeMap.id,
    };
  },
  actions: {
    setConfig(config: SceneConfig) {
      this.config = config;
    },
    setActiveMap(mapId: string, config: SceneConfig) {
      this.activeMapId = mapId;
      this.config = config;
      setActiveMapId(mapId);
      const map = getMapLibrary().find((item) => item.id === mapId);
      if (map) {
        setPositionTransform(derivePositionTransform(map));
      }
    },
  },
});
