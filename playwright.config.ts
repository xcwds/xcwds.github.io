import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testDir: 'e2e',
	// On a CI pull request, Playwright's git diff capture runs `git fetch origin <base> --depth=1`,
	// which turns ci.yml's full-history checkout into a shallow clone, and the build (started by
	// webServer after that) then can't number new changelog entries. The report doesn't need it.
	captureGitInfo: { diff: false },
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
		trace: 'retain-on-failure',
		// No service worker unless a test file opts in with `test.use({ serviceWorkers: 'allow' })`
		// (pwa, update and errors do) (#91). Every page registers the app's worker, which then
		// precaches the whole site; Playwright closing the context mid-install, with two workers
		// in parallel, still crashed the browser now and then (SEGV at 0x1b0, the next
		// newContext failing). In a stress run of 12,240 tests per setup on CI, today's setup
		// failed 6 times (in 3 of 6 jobs); blocking service workers elsewhere failed 0 times, and
		// so did a single worker, which is 1.7× slower. Blocking is also faster than allowing.
		serviceWorkers: 'block'
	}
});
