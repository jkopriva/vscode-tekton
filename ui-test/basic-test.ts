/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, VSBrowser, WebDriver } from 'vscode-extension-tester';
import { commands } from './common/constants';
import { clearNotifications } from './common/utils';

export function basicTests() {
  let driver: WebDriver;

  describe('Check About Tekton', () => {
    beforeEach(async () => {
      driver = VSBrowser.instance.driver;
      await clearNotifications();
    });

    it('Start Command should show a notification with the correct text', async function () {
      this.timeout(30000);
      await await new Workbench().executeCommand(commands.ABOUT_TEKTON);
    });

    afterEach(async () => {
      await clearNotifications();
    });
  });

}
