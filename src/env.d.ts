/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MQTT_WS_URL?: string;
  readonly VITE_TRAJECTORY_API_URL?: string;
  readonly VITE_DEFAULT_LOCALE?: 'zh-CN' | 'en';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.glb' {
  const src: string;
  export default src;
}
