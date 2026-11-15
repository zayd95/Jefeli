/** Absolute fill style (StyleSheet.absoluteFillObject was removed from RN 0.88 typings). */
export const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * Fill for <VideoView>. On the web expo-video hands this style to a raw <video>, a replaced
 * element that top/left/right/bottom: 0 do not stretch: without an explicit size it renders at
 * the file's pixel size in the top-left corner (a 1080×1920 clip shows as a zoomed crop).
 */
export const videoFill = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
