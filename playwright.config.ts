import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testDir: 'e2e',
	// On CI: annotate failures on the PR and keep an HTML report (uploaded by ci.yml).
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { trace: 'retain-on-failure' }
});
