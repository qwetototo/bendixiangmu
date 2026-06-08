import { defineStore } from 'pinia';
import type { SceneConfig } from '@/types/scene';
import { getActiveMap, setActiveMapId } from '@/services/mapLibrary';

interface SceneState {
  config: SceneConfig;
  activeMapId: string;
}

export const useSceneStore = defineStore('scene', {
  state: (): SceneState => ({
    config: getActiveMap().config,
    activeMapId: getActiveMap().id,
  }),
  actions: {
    setConfig(config: SceneConfig) {
      this.config = config;
    },
    setActiveMap(mapId: string, config: SceneConfig) {
      this.activeMapId = mapId;
      this.config = config;
      setActiveMapId(mapId);
    },
  },
});
