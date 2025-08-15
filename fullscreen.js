export async function toggleFullscreen(element) {
  if (!document.fullscreenElement) {
    await element.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
}
