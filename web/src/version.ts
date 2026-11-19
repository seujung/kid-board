declare const __APP_VERSION__: string | undefined;

/** 빌드할 때 정한 앱 버전입니다(vite.config.ts의 `define`). 정의가 없으면 "dev"입니다. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
