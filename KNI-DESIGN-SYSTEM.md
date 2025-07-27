# KNI Education Design System

This document outlines the complete design system used in the KNI Education web application, based on thorough analysis of the main page components and styling.

## 🎨 Color Palette

### Primary Colors
- **Orange Primary**: `#FF914D` (rgb(255, 145, 77)) - Main brand color
- **Orange 500**: `#F97316` - Buttons, highlights, active states
- **Orange 600**: `#EA580C` - Hover states, darker accents

### Secondary Colors
- **Blue Primary**: `#1E40AF` - Secondary actions, dashboard elements
- **Blue 600**: `#2563EB` - Blue button variants
- **Red 600**: `#DC2626` - Error states, important highlights
- **Purple 600**: `#9333EA` - Icon backgrounds, special elements
- **Green 500**: `#10B981` - Success states, positive indicators

### Neutral Colors
- **Gray 900**: `#111827` - Primary text, dark backgrounds
- **Gray 800**: `#1F2937` - Secondary headings
- **Gray 700**: `#374151` - Body text
- **Gray 600**: `#4B5563` - Muted text
- **Gray 500**: `#6B7280` - Placeholder text
- **Gray 300**: `#D1D5DB` - Borders, dividers
- **Gray 200**: `#E5E7EB` - Light borders, backgrounds
- **Gray 100**: `#F3F4F6` - Section backgrounds
- **Gray 50**: `#F9FAFB` - Light section backgrounds
- **White**: `#FFFFFF` - Card backgrounds, primary background

## 📝 Typography

### Font Family
- **Primary**: Inter, sans-serif
- **Monospace**: Roboto Mono, monospace

### Font Sizes & Line Heights
- **text-xs**: 0.75rem (line-height: 1.5)
- **text-sm**: 0.875rem (line-height: 1.5715)
- **text-base**: 1rem (line-height: 1.5, letter-spacing: -0.017em)
- **text-lg**: 1.125rem (line-height: 1.5, letter-spacing: -0.017em)
- **text-xl**: 1.25rem (line-height: 1.5, letter-spacing: -0.017em)
- **text-2xl**: 1.5rem (line-height: 1.415, letter-spacing: -0.037em)
- **text-3xl**: 1.875rem (line-height: 1.3333, letter-spacing: -0.037em)
- **text-4xl**: 2.25rem (line-height: 1.2777, letter-spacing: -0.037em)
- **text-5xl**: 3rem (line-height: 1, letter-spacing: -0.037em)
- **text-6xl**: 4rem (line-height: 1, letter-spacing: -0.037em)

### Typography Hierarchy
- **Hero Titles**: `text-5xl md:text-6xl font-bold text-gray-900`
- **Section Titles**: `text-4xl md:text-5xl font-bold text-gray-900`
- **Subsection Titles**: `text-3xl font-semibold text-gray-900`
- **Card Titles**: `text-xl font-bold text-gray-900`
- **Body Text**: `text-lg text-gray-700` or `text-gray-600`
- **Small Text**: `text-sm text-gray-500`
- **Labels**: `text-sm uppercase font-semibold tracking-wider`

## 🏗️ Layout Principles

### Container Widths
- **Max Width**: `max-w-6xl` (1152px)
- **Padding**: `px-4 sm:px-6` (responsive horizontal padding)
- **Centering**: `mx-auto` (center containers)

### Grid Systems
- **Two Column**: `grid grid-cols-1 md:grid-cols-2 gap-8`
- **Three Column**: `grid grid-cols-1 md:grid-cols-3 gap-6`
- **Four Column**: `grid grid-cols-2 md:grid-cols-4 gap-6`
- **Stats Cards**: `grid grid-cols-2 md:grid-cols-4 gap-6`

### Spacing
- **Section Padding**: `py-16` (64px vertical)
- **Large Spacing**: `mb-12` (48px)
- **Medium Spacing**: `mb-8` (32px)
- **Small Spacing**: `mb-4` (16px)
- **Card Padding**: `p-6` (24px)

## 🎯 Component Patterns

### Buttons

#### Primary Button (Orange)
```css
className="bg-orange-500 text-white px-12 py-3 rounded-full shadow-5xl shadow-orange-500/50 hover:bg-orange-600 transition font-bold"
```

#### Secondary Button (Blue)
```css
className="border border-blue-900 text-blue-900 px-6 py-3 rounded-full shadow-md hover:bg-blue-50 transition font-bold"
```

#### CTA Button with Gradient
```css
className="btn group bg-linear-to-t from-orange-600 to-orange-500 text-white shadow-sm hover:bg-[length:100%_150%]"
```

### Cards

#### Standard Card
```css
className="bg-white p-6 rounded-lg shadow-sm"
```

#### Stats Card
```css
className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-between min-h-[120px]"
```

#### Feature Card with Icon
```css
<div className="bg-white p-6 rounded-lg shadow-sm">
  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
    <Icon className="text-purple-600" size={24} />
  </div>
  <h3 className="text-xl font-bold text-gray-900 mb-2">Title</h3>
  <p className="text-gray-600">Description</p>
</div>
```

### Sections

#### Light Section
```css
className="py-16 bg-white"
```

#### Gray Section
```css
className="py-16 bg-gray-100"
```

#### Dark Section
```css
className="min-h-screen bg-gray-900 text-white"
```

### Labels & Tags
```css
className="inline-block mb-4 px-4 py-1 bg-gray-200 text-gray-700 text-sm font-semibold rounded-full"
```

```css
className="text-sm uppercase text-orange-500 font-semibold tracking-wider mb-2"
```

## 🎭 Animation & Effects

### AOS (Animate On Scroll) Patterns
- **Fade In**: `data-aos="fade-in"` with delays (100, 200, 300ms)
- **Fade Up**: `data-aos="fade-up"` with delays
- **Fade Down**: `data-aos="fade-down"` with delays
- **Fade Left/Right**: `data-aos="fade-left"` / `data-aos="fade-right"`
- **Zoom**: `data-aos="zoom-y-out"`

### Custom Animations
- **Fade In Slide Up**: Custom class for image transitions
- **Infinite Scroll**: For testimonials and logos
- **Float**: Subtle floating animation for elements
- **Breath**: Scaling animation for emphasis

### Transitions
- **Standard**: `transition` or `transition-colors`
- **Transform**: `transition-transform`
- **Hover Scale**: `hover:scale-105`

## 🖼️ Image Patterns

### Hero Images
```css
className="rounded-lg shadow-md"
width={500} height={400}
```

### Profile Images
```css
className="rounded-full"
width={50} height={50}
```

### Overlapping Images
```css
className="absolute bottom-0 right-0 shadow-md border-amber-50 border-5"
```

## 🎨 Background Patterns

### Gradient Backgrounds
```css
className="bg-gradient-to-br from-gray-50 via-orange-50 to-red-50"
```

### Dark Sections with Glow Effects
```css
<div className="absolute bottom-0 left-1/2 -z-10 -translate-x-1/2 translate-y-1/2">
  <div className="h-56 w-[480px] rounded-full border-[20px] border-orange-500 blur-3xl" />
</div>
```

## 📱 Responsive Design

### Breakpoints
- **Mobile**: Default (< 810px)
- **Tablet**: `md:` (810px+)
- **Desktop**: `lg:` (1200px+)

### Responsive Patterns
- **Text Sizes**: `text-4xl md:text-5xl`
- **Grid Columns**: `grid-cols-1 md:grid-cols-2`
- **Spacing**: `py-12 md:py-20`
- **Order**: `order-2 md:order-1`
- **Visibility**: `hidden md:block`

## 🎯 Icon Usage

### Icon Libraries
- **React Icons**: `react-icons/fa`, `react-icons/io`
- **Heroicons**: `@heroicons/react/24/outline`

### Icon Patterns
- **Feature Icons**: 24px size, colored backgrounds
- **List Icons**: 16-20px size, inline with text
- **Button Icons**: Small, with spacing (`ml-2`)

## 🎨 Brand Elements

### Logo Usage
- **Header Logo**: 48x48px
- **Hero Logo**: Custom TestAS logo component
- **Favicon**: `/icon.png`

### Brand Colors in Context
- **Primary Actions**: Orange (#FF914D)
- **Secondary Actions**: Blue
- **Success States**: Green
- **Warning/Important**: Red
- **Neutral Elements**: Gray scale

## 📋 Content Patterns

### Section Structure
1. **Label** (optional): Small uppercase text
2. **Title**: Large, bold heading
3. **Subtitle**: Supporting description
4. **Content**: Cards, lists, or body text
5. **CTA** (optional): Action buttons

### List Items with Icons
```css
<li className="flex items-center mb-8">
  <div className="h-16 min-w-16 flex items-center justify-center">
    <Icon className="text-orange-600" size={24} />
  </div>
  <p className="text-xl text-gray-300">Content</p>
</li>
```

## 🎪 Special Effects

### Sticky Elements
```css
className="sticky top-20"
```

### Scroll Snap
```css
className="snap-start" // or "snap-center"
```

### Shadows
- **Card Shadow**: `shadow-sm` or `shadow-md`
- **Button Shadow**: `shadow-5xl shadow-orange-500/50`
- **Image Shadow**: `shadow-md`

### Borders
- **Gradient Borders**: `border-y [border-image:linear-gradient(...)]`
- **Dashed Dividers**: `border-l border-dashed border-gray-400`

This design system ensures consistency across all KNI Education components while maintaining the professional, modern, and educational brand identity.