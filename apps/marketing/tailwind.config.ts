import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'syntropi': {
          blue: '#5449DE',
          purple: '#B63FDE',
          'light-blue': '#EFEDFC',
          'soft-lavender': '#F5F3FF',
          'dark-blue': '#3F38A6',
          'background': '#F9F9FB',
          'text-primary': '#1A1A1A',
          'text-secondary': '#4A4A4A',
          'border': '#E5E7EB',
        },
      },
      backgroundImage: {
        'syntropi-gradient': 'linear-gradient(90deg, #5449DE 0%, #B63FDE 100%)',
        'syntropi-gradient-reverse': 'linear-gradient(270deg, #5449DE 0%, #B63FDE 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config; 