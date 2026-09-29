/**
 * Signet theme definition
 * Contains colors, animations, and common style utilities
 */

// Color palette
export const colors = {
  cyber: "rgb(125, 249, 255)",    // Bright cybertruck teal
  cyberDark: "rgb(0, 176, 189)",
  cyberLight: "rgb(165, 253, 255)",
  neonPink: "rgb(218, 47, 183)",
  neonPurple: "rgb(140, 50, 193)",
  neonGreen: "rgb(54, 199, 88)",
  neonOrange: "rgb(255, 149, 0)",
  neonRed: "rgb(255, 59, 48)",
  spaceBlack: "rgb(13, 17, 23)",
  spaceDark: "rgb(22, 27, 34)",
  spaceGray: "rgb(33, 38, 45)",
  spaceVoid: "rgb(1, 4, 9)",
  steel: "rgb(140, 156, 168)",
  steelLight: "rgb(192, 203, 212)",
  white: "rgb(255, 255, 255)",
  black: "rgb(0, 0, 0)"
}

// Type mapping for notifications
export const notificationColors = {
  TRANSACTION: colors.cyber,
  OP_PREDICT: colors.neonOrange,
  SYSTEM: colors.neonGreen,
  ERROR: colors.neonRed
}

// Animation keyframes
export const keyframes = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  slideInUp: `
    @keyframes slideInUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
  slideInRight: `
    @keyframes slideInRight {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  scanLine: `
    @keyframes scanLine {
      0% { transform: translateY(0%); }
      100% { transform: translateY(100%); }
    }
  `,
  shimmer: `
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
    }
  `,
  float: `
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `
}

/**
 * A color at the given opacity (0-1). Theme colors are rgb(); appending hex alpha ("${color}66") doesn't work on them.
 */
export const tint = (color: string, alpha: number) =>
  color.startsWith('rgb(')
    ? color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
    : `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;

// Common styles with consistent appearance
export const commonStyles = {
  // Border with glow effect
  glowBorder: (color: string = colors.cyber, alpha: number = 0.2) => ({
    border: `1px solid ${tint(color, alpha)}`,
    boxShadow: `0 0 10px ${tint(color, alpha)}, 0 0 5px ${tint(color, 0.13)}`
  }),
  
  // Background with gradient
  darkGradient: {
    background: `linear-gradient(180deg, ${colors.spaceBlack} 0%, ${colors.spaceVoid} 100%)`
  },
  
  // Panel background with blur
  panelBackground: {
    background: `rgba(1, 4, 9, 0.8)`,
    backdropFilter: 'blur(4px)'
  },
  
  // Header style with shimmer
  headerBackground: {
    background: `linear-gradient(90deg, rgba(13, 17, 23, 0.8) 0%, rgba(125, 249, 255, 0.1) 50%, rgba(13, 17, 23, 0.8) 100%)`
  }
}

// Animation presets
export const animations = {
  // Pulsing dot animation
  pulsingDot: (color: string = colors.cyber) => ({
    animate: {
      boxShadow: [
        `0 0 2px ${tint(color, 0.53)}`, 
        `0 0 8px ${tint(color, 0.67)}`, 
        `0 0 2px ${tint(color, 0.53)}`
      ]
    },
    transition: { duration: 2, repeat: Infinity }
  }),
  
  // Shimmer animation
  shimmer: {
    animate: { x: ['-100%', '100%'] },
    transition: { duration: 2, repeat: Infinity, ease: 'linear' }
  },
  
  // Float animation
  float: {
    animate: { y: [0, -5, 0] },
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
  }
}