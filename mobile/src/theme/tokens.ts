/**
 * Emaal runs the "Organic" design system with its accent ramp swapped for
 * teal (the color/brand change requested partway through the design chats),
 * and the app renamed to Emaal throughout. Values are ported 1:1 from
 * project/_ds/.../styles.css and the inline override at the top of
 * "Wallet Admin.dc.html" — React Native has no CSS variables, so this file
 * is the single source of truth every screen imports from instead of
 * hard-coding colors.
 */

export const colors = {
  bg: "#f5ead8",
  surface: "#ebddc5",
  text: "#201e1d",

  accent: "#2f8f7d",
  accent100: "#e9f7f3",
  accent200: "#cdeee6",
  accent300: "#a1ddd0",
  accent400: "#6bc4b2",
  accent500: "#3ea792",
  accent600: "#2d8b78",
  accent700: "#1f6d5d",
  accent800: "#144d42",
  accent900: "#0e332c",

  accent2_100: "#f0fae1",
  accent2_200: "#e1eecc",
  accent2_300: "#ccdbb2",
  accent2_400: "#aebf92",
  accent2_500: "#8fa073",
  accent2_600: "#728157",
  accent2_700: "#56633f",
  accent2_800: "#3d472b",
  accent2_900: "#272e1b",

  neutral100: "#f9f4ed",
  neutral200: "#eee7db",
  neutral300: "#dcd3c4",
  neutral400: "#c0b6a5",
  neutral500: "#a19786",
  neutral600: "#82796a",
  neutral700: "#645c50",
  neutral800: "#474238",
  neutral900: "#2e2b25",

  danger: "#9e3b2a",
  dangerBg: "#f6dcd4",

  white: "#ffffff",
} as const;

export const space = {
  1: 4.4,
  2: 8.8,
  3: 13.2,
  4: 17.6,
  6: 26.4,
  8: 35.2,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 28,
  pill: 999,
} as const;

export const shadow = {
  sm: { shadowColor: colors.neutral900, shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: colors.neutral900, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  lg: { shadowColor: colors.neutral900, shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
} as const;

export const fonts = {
  heading: "Caprasimo_400Regular",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;

export const type = {
  displayLg: { fontFamily: fonts.heading, fontSize: 34 },
  displayMd: { fontFamily: fonts.heading, fontSize: 27 },
  displaySm: { fontFamily: fonts.heading, fontSize: 19 },
  body: { fontFamily: fonts.body, fontSize: 15 },
  bodySm: { fontFamily: fonts.body, fontSize: 13 },
  label: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" as const },
};
