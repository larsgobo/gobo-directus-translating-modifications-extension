export function unexpectedError(error: unknown): void {
	// eslint-disable-next-line no-console
	console.warn('[gobo-translations-grid]', error);
}
