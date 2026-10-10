import type { Config } from 'tailwindcss'

// Colours, radii and shadows come from the design tokens in src/app/globals.css.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mjs}'],
  theme: { extend: {} },
  plugins: [],
}

export default config
