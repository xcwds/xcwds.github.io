/**
 * Server unit tests boot the app's plugins in Node. With `apps` set, `@xcwds/plugin-tools` marks
 * the apps that are off on `<html>` when it boots (`data-apps-off`), so give it an `<html>` to
 * mark. Remove once the plugin skips that without a DOM (xcwds/xcwds#178).
 */
if (typeof document === 'undefined') {
	const attributes = new Map<string, string>();
	Object.assign(globalThis, {
		document: {
			documentElement: {
				setAttribute: (name: string, value: string) => void attributes.set(name, value),
				getAttribute: (name: string) => attributes.get(name) ?? null,
				removeAttribute: (name: string) => void attributes.delete(name)
			}
		}
	});
}
