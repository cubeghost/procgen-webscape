export default [
  {
    id: "landscape",
    width: 512,
    height: 384,
    mediaQuery: "min-aspect-ratio: 3/4",
  },
  {
    id: "portrait",
    width: 256,
    height: 496,
    mediaQuery: "max-aspect-ratio: 3/4",
  },
] as const;
