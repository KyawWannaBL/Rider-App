export async function selectGalleryPhoto<T>(embedded: (() => Promise<T>) | undefined, standard: () => Promise<T>): Promise<T> {
  if (!embedded) return standard();
  try {
    return await embedded();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'EMBEDDED_UNAVAILABLE' || code === 'UNAVAILABLE' || code === 'UNIMPLEMENTED') return standard();
    // Cancelling must leave the existing photo intact, without opening a second picker.
    throw error;
  }
}
