import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testDir: 'e2e',
	// On CI: annotate failures on the PR and keep an HTML report (uploaded by ci.yml).
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		// Full Chromium in its new headless mode, not the separate chrome-headless-shell: on CI
		// the shell segfaulted (GPU process, SEGV at 0x1b0) partway through the suite and took
		// the remaining tests down with it. `playwright install chromium` installs both.
		channel: 'chromium',
		// No GPU process (#75). On CI, Chromium kept crashing a few tests into a run: a renderer
		// lost its GPU channel ("Failed to send GpuControl.CreateCommandBuffer"), then the browser
		// segfaulted (SEGV at 0x1b0, in both builds), so the next test couldn't open a context.
		// The app needs no GPU; software rendering avoids that path.
		launchOptions: { args: ['--disable-gpu'] },
		trace: 'retain-on-failure'
	}
});
