import {defineCliConfig} from 'sanity/cli'
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  studioHost: 'yalynky-admin',
  deployment: { appId: 'lanx1hp0s7qlerm5exq30v8f' },
})
