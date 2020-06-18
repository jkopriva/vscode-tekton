/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, VSBrowser, WebDriver, BottomBarPanel, ActivityBar} from 'vscode-extension-tester';
import { clearNotifications} from './common/utils';
import { terminalChannelExists, outputChannelExists, terminalHasText, outputHasText } from './common/conditions';
import { expect } from 'chai';

export function basicTests(): void {
  let driver: WebDriver;

  before(async function() {
    driver = VSBrowser.instance.driver;
    this.timeout(40000);
    //const notification = await driver.wait(() => { return notificationExists('Hello'); }, 20000) as Notification;
  });


  describe('Check About Tekton', () => {
    beforeEach(async () => {
      driver = VSBrowser.instance.driver;
      await clearNotifications();
    });

    it('About Command should have correct output in Terminal view', async function () {
      this.timeout(30000);
      await new Workbench().executeCommand('Tekton: About');
      driver.sleep(1000);
      await driver.wait(() => { return terminalChannelExists('Tekton'); }, 60000);
      const terminalView = await new BottomBarPanel().openTerminalView();
      terminalHasText(terminalView, 'tkn version');
    });

    it('Show Output Channel Command should have correct output in Output view', async function () {
      this.timeout(30000);
      await new Workbench().executeCommand('Tekton: Show Output Channel');
      driver.sleep(1000);      
      await driver.wait(() => { return outputChannelExists('Tekton Pipelines'); }, 10000);
      const outputView = await new BottomBarPanel().openOutputView();
      outputHasText(outputView, '/usr/local/bin/tkn');
    });

    it('About Command should have correct output in terminal', async function () {
      this.timeout(30000);
      await await new Workbench().executeCommand('Tekton: Refresh View');
      //TODO  check terminal output
    });

    it('OpenShift view should be available', async () => {
      const viewItems = await new ActivityBar().getViewControls();
      //let osView: ViewControl;
      const osView = viewItems.find((view) => {
        return (view.getTitle() === 'Tekton Pipelines');
      });

      expect(osView).not.undefined;
    });

    afterEach(async () => {
      await clearNotifications();
    });
  });

}
