# Charisma Design System

A comprehensive design system inspired by Apple and Tesla's premium aesthetic, emphasizing glass morphism, seamless interactions, and sophisticated visual hierarchy.

## Core Philosophy

### Seamless Interaction Principles
- **No visual disruption**: UI elements should feel like natural extensions of the interface
- **Invisible until needed**: Components should blend into the background until hovered or interacted with
- **Smooth transitions**: All state changes should flow naturally with proper timing and easing
- **Contextual revelation**: Information appears progressively as users need it

### Visual Hierarchy Standards
- **Avoid nested containers**: Never place glass panes inside other glass panes
- **Single-layer depth**: Each UI element should exist on one visual plane
- **Consistent elevation**: Use backdrop blur and opacity to create depth, not multiple borders
- **Clean separation**: Use subtle borders and spacing instead of nested visual containers

## Glass Morphism Implementation

### Primary Glass Effects
```css
/* Main container glass */
bg-white/[0.02] border border-white/[0.06] rounded-2xl backdrop-blur-sm

/* Interactive elements */
bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12]

/* Headers and prominent areas */
bg-white/[0.04] border border-white/[0.08] backdrop-blur-md
```

### Opacity Hierarchy
- **0.02**: Base container backgrounds
- **0.03**: Interactive element backgrounds
- **0.04**: Header and navigation backgrounds
- **0.05**: Hover states for base elements
- **0.06**: Base borders
- **0.08**: Interactive borders and prominent backgrounds
- **0.1**: Active/selected states
- **0.12**: Hover borders for interactive elements

### Border Guidelines
- **Never double borders**: Avoid placing bordered elements inside other bordered containers
- **Single border rule**: Each visual element should have only one visible border
- **Consistent radius**: Use `rounded-xl` (12px) for most elements, `rounded-2xl` (16px) for containers

## Color System

### Text Hierarchy
```css
/* Primary text */
text-white/95

/* Secondary text */
text-white/90

/* Tertiary text */
text-white/70

/* Muted text */
text-white/60

/* Disabled text */
text-white/40
```

### Status Colors
```css
/* Success/positive */
text-green-400, bg-green-500/20

/* Warning */
text-yellow-400, bg-yellow-500/20

/* Error/negative */
text-red-400, bg-red-500/20

/* Info/neutral */
text-blue-400, bg-blue-500/20

/* Subnet/special */
text-purple-400, bg-purple-500/20
```

### Interactive States
```css
/* Default state */
text-white/70

/* Hover state */
text-white/90

/* Active/selected */
text-white/95
```

## Component Patterns

### Invisible Until Hover
Components should be visually minimal until user interaction reveals additional functionality.

```tsx
// Example: Balance section that reveals on hover
<div className="bg-transparent hover:bg-white/[0.03] rounded-xl p-4 transition-all duration-200">
  {/* Content only visible/prominent on hover */}
</div>
```

### Progressive Disclosure
Information architecture should reveal complexity gradually:

1. **Essential info always visible**
2. **Secondary info on hover**
3. **Detailed info on click/expand**
4. **Advanced options in dedicated spaces**

### Sidebar Integration
- **Left sidebar**: Route intelligence and analysis
- **Right sidebar**: Swap information and security details
- **Mobile overlays**: Dark mask with `bg-black/80 backdrop-blur-xl`
- **Responsive behavior**: Collapse to mobile overlays below xl breakpoint

## Interactive Design Rules

### Hover Effects
- **Subtle elevation**: Increase background opacity by 0.02-0.03
- **Border enhancement**: Increase border opacity from 0.06 to 0.12
- **Smooth transitions**: Always use `transition-all duration-200`
- **No dramatic changes**: Avoid sudden size, color, or position changes

### Button States
```css
/* Default */
bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white/90

/* Primary action */
bg-white/[0.1] text-white/95 hover:bg-white/[0.15] hover:text-white/100

/* Disabled */
bg-white/[0.02] text-white/40 cursor-not-allowed opacity-50
```

### Focus States
- Use subtle glow effects instead of harsh outlines
- Maintain visual consistency with hover states
- Ensure accessibility without breaking aesthetic

## Layout Principles

### Container Hierarchy
1. **Page container**: Full width with subtle background
2. **Section containers**: Glass morphism with proper spacing
3. **Content areas**: Transparent backgrounds with hover effects
4. **Interactive elements**: Minimal styling until interaction

### Spacing System
```css
/* Component spacing */
space-y-6, space-x-4

/* Container padding */
p-6 lg:p-8 (responsive)

/* Element padding */
p-4 (standard), p-3 (compact), p-5 (generous)

/* Gaps */
gap-6 (sections), gap-4 (related elements), gap-2 (tight groups)
```

### Responsive Breakpoints
```css
/* Mobile first approach */
base: /* Mobile styles */
sm: 640px
md: 768px
lg: 1024px  /* Sidebars become visible */
xl: 1280px  /* Full sidebar layout */
2xl: 1536px /* Advanced features visible */
3xl: 1600px /* Pro features visible (custom) */
```

## Typography

### Font Weights
- **font-medium**: Standard UI text
- **font-semibold**: Headings and important labels
- **font-bold**: Rare, only for critical emphasis

### Size Scale
```css
text-xs   /* 12px - Supporting text */
text-sm   /* 14px - Standard UI text */
text-base /* 16px - Body text */
text-lg   /* 18px - Subheadings */
text-xl   /* 20px - Section titles */
text-2xl  /* 24px - Page titles */
```

## Animation & Motion

### Transition Timing
```css
/* Standard interactions */
transition-all duration-200

/* Complex state changes */
transition-all duration-300

/* Loading and progress */
transition-all duration-1000 ease-out
```

### Animation Principles
- **Purposeful motion**: Every animation should serve a functional purpose
- **Consistent easing**: Use standard easing curves for predictability
- **Performance first**: Prefer CSS transforms over layout changes
- **Respectful timing**: Don't overwhelm users with excessive animation

## Anti-Patterns to Avoid

### Visual Anti-Patterns
❌ **Nested glass panes**: Never put glass containers inside other glass containers
❌ **Double borders**: Avoid multiple border layers on the same element
❌ **Harsh transitions**: No sudden color or size changes
❌ **Visual clutter**: Too many visual elements competing for attention

### Interaction Anti-Patterns
❌ **Surprise changes**: Don't dramatically alter layout on hover
❌ **Inconsistent feedback**: All similar actions should have similar visual feedback
❌ **Poor contrast**: Don't sacrifice readability for aesthetics
❌ **Jarring motion**: Avoid animations that feel mechanical or abrupt

### Layout Anti-Patterns
❌ **Inconsistent spacing**: Use the defined spacing system consistently
❌ **Poor hierarchy**: Make sure visual importance matches functional importance
❌ **Overcrowded interfaces**: Allow breathing room between elements
❌ **Responsive neglect**: Ensure all interactions work across screen sizes

## Implementation Guidelines

### Component Structure
```tsx
// Standard component pattern
<div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-sm">
  <div className="space-y-4">
    {/* Content with proper hierarchy */}
  </div>
</div>
```

### Hover Enhancement Pattern
```tsx
// Invisible until hover pattern
<div className="bg-transparent hover:bg-white/[0.03] rounded-xl p-4 transition-all duration-200">
  {/* Content that becomes prominent on hover */}
</div>
```

### Modal/Overlay Pattern
```tsx
// Full-screen overlay with proper backdrop
<div 
  className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-xl"
  onClick={close}
>
  <div 
    className="relative flex flex-col h-full max-w-2xl mx-auto w-full"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Modal content */}
  </div>
</div>
```

## Quality Assurance

### Visual Consistency Checklist
- [ ] No nested glass panes
- [ ] Consistent opacity hierarchy
- [ ] Proper spacing system usage
- [ ] Smooth transitions on all interactions
- [ ] Appropriate text contrast ratios
- [ ] Responsive behavior tested

### Interaction Quality Checklist
- [ ] Hover states feel natural and seamless
- [ ] Loading states are informative and branded
- [ ] Error states are helpful but not jarring
- [ ] Mobile interactions are touch-friendly
- [ ] Keyboard navigation is smooth
- [ ] Focus states are visible but aesthetic

### Performance Checklist
- [ ] Animations use CSS transforms where possible
- [ ] Backdrop blur is used judiciously
- [ ] No layout thrashing on interactions
- [ ] Responsive images and assets
- [ ] Minimal repaints and reflows

## Future Considerations

### Accessibility
- Maintain WCAG 2.1 AA compliance
- Ensure proper color contrast ratios
- Support keyboard navigation
- Provide screen reader friendly alternatives

### Dark Mode Consistency
- Current system is dark-mode first
- Light mode would require careful opacity adjustments
- Maintain glass morphism aesthetic in both modes

### Scalability
- Component patterns should work at any scale
- Design system should support new features gracefully
- Maintain consistency as the product grows

---

*This design system is living documentation and should be updated as patterns evolve and new requirements emerge.*