/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_LOGO: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly VITE_ANALYTICS_WEBSITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
