---
name: Derby & Drafts
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#ffb0cd'
  on-secondary: '#640039'
  secondary-container: '#aa0266'
  on-secondary-container: '#ffbad3'
  tertiary: '#54ddfc'
  on-tertiary: '#003640'
  tertiary-container: '#29c1df'
  on-tertiary-container: '#004b58'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#ffd9e4'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#3e0022'
  on-secondary-fixed-variant: '#8c0053'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 120px
    fontWeight: '900'
    lineHeight: 110px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '900'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '900'
    lineHeight: 44px
  headline-md:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
  body-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  label-bold:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 64px
  gutter: 32px
  card-padding: 40px
  stack-gap-lg: 48px
---

## Brand & Style
The design system is engineered for high-stakes social entertainment, specifically a horse racing drinking game. The brand personality is electric, competitive, and unapologetically bold, designed to command attention in a room full of people. It targets a social audience in "watch-party" environments, where the UI acts as a digital centerpiece.

The visual style is a fusion of **Modern Sportsbook** and **High-Contrast Boldness**. It utilizes "Big Screen" optimization, prioritizing legibility from a distance (the "10-foot UI" rule). Elements are chunky and tactile, evoking a premium casino feel while maintaining the playful energy of a house party. The aesthetic avoids clutter, using massive typography and vibrant neon accents to guide the eye through fast-paced gameplay states and "drink" prompts.

## Colors
The palette is built on a foundation of "Midnight Navy" (#0F172A) to provide a deep, high-contrast backdrop that makes vibrant colors pop. 

- **Primary (Energetic Gold):** Reserved for "Winner" states, podiums, and top-tier achievements.
- **Secondary (Neon Pink):** Used exclusively for high-urgency interactions, countdown timers, and "Take a Drink" notifications to ensure they are never missed.
- **Suits:** Each suit (Coins, Cups, Swords, Clubs) is assigned a distinct, high-vibrancy color to allow for instant recognition during rapid card flips.
- **Surface Tints:** Use 5-10% opacity overlays of suit colors on card backgrounds to reinforce the suit identity without compromising text legibility.

## Typography
Typography is the primary driver of the "Big Screen" experience. We use **Inter** for its incredible clarity and aggressive presence in heavy weights.

- **Display & Headlines:** Must always be uppercase with tight tracking. Use `display-xl` for "Winner" announcements and large numbers (e.g., drink counts).
- **Labels:** **Space Grotesk** is used for utility labels and technical data to provide a slight "tech/sport" aesthetic contrast to the heavy Inter headlines.
- **Accessibility:** Ensure all text on dark backgrounds uses a minimum weight of 600 to prevent font thinning on bright displays.

## Layout & Spacing
This design system utilizes a **Fixed Grid** model optimized for 16:9 television displays and tablets. 

- **Desktop/TV:** A 12-column grid with massive 64px outer margins to account for "overscan" on older televisions. Gutters are kept wide (32px) to maintain a clean, premium look.
- **Mobile:** Switches to a 4-column fluid layout with 24px margins.
- **Rhythm:** All spacing must be multiples of 8px. Use exaggerated vertical gaps (`stack-gap-lg`) to separate different phases of the racing game.

## Elevation & Depth
Depth is created through **Glassmorphism** and **Tonal Layering** rather than traditional shadows. 

- **Surfaces:** Use semi-transparent dark fills (e.g., `rgba(30, 41, 59, 0.7)`) with a 20px backdrop blur for modal overlays and player cards.
- **Borders:** Instead of shadows, use 2px solid borders for standard elements and 4px "glowing" borders (using `box-shadow: 0 0 15px`) for active horses or current turn indicators.
- **Active State:** Elements that are currently "in play" should scale up by 5% and increase their backdrop-blur intensity to stand out from the background track.

## Shapes
The shape language is "Chunky-Friendly." 

- **Corner Radius:** Standard components use a `0.5rem` (8px) radius. Larger containers and cards use `1.5rem` (24px) to emphasize the "game board" feel.
- **Interaction:** Buttons should feel "squishy" — use a heavy bottom border (4px) in a slightly darker shade of the button color to create a 3D effect that disappears on press, mimicking a physical arcade button.

## Components
- **Game Cards:** Representing Spanish playing cards, these are simplified icons centered on large, vertical glass containers. The suit icon should be oversized, taking up 60% of the card's height.
- **Oversized Buttons:** Primary actions (e.g., "FLIP NEXT") must span at least 80px in height with `headline-md` typography.
- **Progress Bars:** These represent the race track. They should be 32px thick, with a rounded "pill" indicator for the horse's position. The track itself should be a dark, recessed "trench" (inner shadow).
- **Drink Alerts:** Full-screen modal overlays with Neon Pink backgrounds and `display-xl` typography. These should include a pulse animation to capture immediate attention.
- **Player Chips:** Circular avatars with a 4px colored ring corresponding to the suit they are betting on.