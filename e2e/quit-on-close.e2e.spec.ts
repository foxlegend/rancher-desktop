import { test, expect, ElectronApplication } from '@playwright/test';

import { createDefaultSettings, packageLogs, startRancherDesktop, teardown } from './utils/TestUtils';

/**
 * Using test.describe.serial make the test execute step by step, as described on each `test()` order
 * Playwright executes test in parallel by default and it will not work for our app backend loading process.
 * */
test.describe.serial('quitOnClose setting', () => {
  test.afterAll(async() => {
    await packageLogs(__filename);
  });

  test('should quit when quitOnClose is true and window is closed', async() => {
    createDefaultSettings({ application: { window: { quitOnClose: true } } });
    const electronApp = await startRancherDesktop(__filename, { tracing: false });

    await electronApp.firstWindow();

    await expect(closeWindowsAndCheckQuit(electronApp)).resolves.toBe(true);
  });

  test('should not quit when quitOnClose is false and window is closed', async() => {
    createDefaultSettings({ application: { window: { quitOnClose: false } } });
    const electronApp = await startRancherDesktop(__filename);

    try {
      await electronApp.firstWindow();
      await expect(closeWindowsAndCheckQuit(electronApp)).resolves.toBe(false);
    } finally {
      try {
        await teardown(electronApp, __filename);
      } catch { }
    }
  });
});

/**
 * Closes all of the windows in a running app. Returns a promise that
 * resolves to true when the app has quit within a certain period of time,
 * or that resolves to false when the app does not quit within that period
 * of time.
 * */
function closeWindowsAndCheckQuit(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(async({ app, BrowserWindow }) => {
    const quitReady = new Promise<boolean>((resolve) => {
      app.on('will-quit', () => resolve(true));
      app.on('window-all-closed', () => {
        setTimeout(() => resolve(false), 3_000);
      });
    });

    await Promise.all(BrowserWindow.getAllWindows().map((window) => {
      return new Promise<void>((resolve) => {
        window.on('closed', resolve);
        window.close();
      });
    }));

    return await quitReady;
  });
}
