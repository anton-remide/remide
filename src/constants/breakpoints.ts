export const BREAKPOINTS = {
  xxl: 1280,
  lg: 1024,
  mdPlus: 991,
  md: 767,
  smWide: 640,
  sm: 600,
  xsWide: 520,
  xs: 480,
  xxs: 375,
} as const;

export const MEDIA_QUERY = {
  mobile: `(max-width: ${BREAKPOINTS.md}px)`,
} as const;

