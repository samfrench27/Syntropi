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
        'syntropi-blue': '#4F8CFF',
        'syntropi-purple': '#9F5CFF',
        
        // Neutral colors
        'background-light': '#F9FAFB',
        'surface': '#FFFFFF',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        
        // Accent colors
        'teal-accent': '#38BDF8',
        'midnight-blue': '#1E3A8A',
        'soft-lavender': '#E0D7FF',
      },
      backgroundImage: {
        'syntropi-gradient': 'linear-gradient(to right, #4F8CFF, #9F5CFF)',
      },
    },
  },
  plugins: [],
} 