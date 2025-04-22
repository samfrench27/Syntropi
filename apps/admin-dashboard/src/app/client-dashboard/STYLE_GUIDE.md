# Syntropi Admin Dashboard Style Guide

## Color Theme
The Syntropi Admin Dashboard uses a custom color theme with the following key colors:

- **Primary Colors:**
  - `syntropi-blue`: #5449DE - Used for primary actions, links, and focus states
  - `syntropi-purple`: #B63FDE - Used for accents, icons, and secondary interactive elements
  - `syntropi-gradient`: Linear gradient from `syntropi-blue` to `syntropi-purple` - Used for primary CTA buttons

- **Background Colors:**
  - `background-light`: #F9F9FB - Used for page backgrounds, cards, and containers
  - `syntropi-light-blue`: #EFEDFC - Used for light blue highlights
  - `syntropi-soft-lavender`: #F5F3FF - Used for hover states, particularly on secondary buttons

- **Text Colors:**
  - `text-primary`: #1A1A1A - Primary text color for headings and body text
  - `text-secondary`: #4A4A4A - Secondary text color for less emphasized content

- **Border Colors:**
  - `syntropi-border`: #E5E7EB - Standard border color for inputs, cards, and other elements

## Typography
- The dashboard uses **Inter** as its primary font family
- Font weights range from 300 (light) to 700 (bold)

## Button Styles
We have several pre-defined button styles to use throughout the application:

### Primary Button (btn-gradient)
```html
<button className="btn-gradient px-4 py-2 rounded-md">Button Text</button>
```
- Uses the gradient background
- White text
- Hover effect: slight opacity reduction

### Secondary Button (btn-secondary)
```html
<button className="btn-secondary px-4 py-2 rounded-md">Button Text</button>
```
- White background with border
- Gray text
- Hover effect: soft lavender background color

### Common Button Modifiers
- Add `flex items-center` for buttons with icons
- Add `disabled opacity-50 cursor-not-allowed` for disabled state

## Form Elements
Form inputs should use the following classes:
- Text inputs: `px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue`
- Select dropdowns: `px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-syntropi-blue`

## Cards and Containers
- Use the Card component for content containers
- Table headers should use `bg-background-light` for the background and `text-text-secondary` for column headers

## Icons
- Default icon size is 16px for inline icons, 24px for featured icons
- Icons in primary actions should match the text color
- Icons used as visual indicators should use appropriate semantic colors

## Status Indicators
- Environment badges: 
  - Production: `bg-soft-lavender text-syntropi-purple`
  - Sandbox/Development: `bg-[#E0F2FE] text-syntropi-blue`
- Status badges:
  - Active/Success: `bg-green-100 text-green-800`
  - Inactive/Error: `bg-red-100 text-red-800`

## Empty States
- Use the EmptyState component with appropriate messaging
- Icon color should be `text-syntropi-purple`
- Action buttons should use the `btn-gradient` class 