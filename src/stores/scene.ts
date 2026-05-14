import { defineStore } from 'pinia';
import floorConfig from '@/assets/config/config.json';
import type { SceneConfig } from '@/types/scene';

interface SceneState {
  config: SceneConfig;
}

export const useSceneStore = defineStore('scene', {
  state: (): SceneState => ({
    config: structuredClone(floorConfig) as unknown as SceneConfig,
  }),
  actions: {
    setConfig(config: SceneConfig) {
      this.config = config;
    },
  },
});
