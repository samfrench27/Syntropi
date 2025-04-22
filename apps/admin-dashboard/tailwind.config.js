/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary gradient colors
        'syntropi-blue': '#5449DE',
        'syntropi-purple': '#B63FDE',
        
        // Neutral colors
        'background-light': '#F9F9FB',
        'surface': '#FFFFFF',
        'text-primary': '#1A1A1A',
        'text-secondary': '#4A4A4A',
        
        // Accent colors
        'syntropi-light-blue': '#EFEDFC',
        'syntropi-soft-lavender': '#F5F3FF',
        'syntropi-dark-blue': '#3F38A6',
        'syntropi-border': '#E5E7EB',
      },
      backgroundImage: {
        'syntropi-gradient': 'linear-gradient(to right, #5449DE, #B63FDE)',
      },
    },
  },
  plugins: [],
} 