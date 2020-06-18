/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { SideBarView, ActivityBar, WebDriver, VSBrowser, InputBox, until, By, ViewSection, Workbench, ViewItem, TreeItem, CustomTreeSection, CustomTreeItem } from 'vscode-extension-tester';
import { assert, expect } from 'chai';
import * as path from 'path';
import { viewHasNoProgress, notificationExists, viewHasItems, inputHasNewMessage, nodeHasNewChildren } from '../common/conditions';
import { setInputTextAndConfirm, quickPick, findNotification } from '../common/utils';
import { notifications, ItemType, itemCreated, itemDeleted, deleteItem } from '../common/constants';

export function pipelineRunTest(clusterUrl: string): void {
  const username = process.env.OPENSHIFT_USERNAME ? process.env.OPENSHIFT_USERNAME : 'developer';
  const password = process.env.OPENSHIFT_PASSWORD ? process.env.OPENSHIFT_PASSWORD : 'developer';
  //const token = process.env.OPENSHIFT_TOKEN;


  //Pipeline -> Start - Start a Pipeline with user indicated resources, parameters and service account.
  //Pipeline -> Restart - Restart the last Pipeline run.
  //Pipeline/Task/ClusterTask -> List - List all Pipelines in a Cluster.
  //Pipeline -> Describe - Prints the JSON of a selected Pipeline.
  //Pipeline/Task/ClusterTask -> Delete - Delete the selected Pipeline.

  describe('Pipeline Actions Test', () => {
    let driver: WebDriver;
    let explorer: CustomTreeSection;
    let pipelinesNode: ViewItem;
    let clusterNode: ViewItem;
    let pipeline: CustomTreeItem;
    let section: CustomTreeSection;
    //const oi: odo.Odo = odo.getInstance();

    const projectName = 'pipelines-tutorial';

    before(async () => {
      driver = VSBrowser.instance.driver;
      const view = await new ActivityBar().getViewControl('Tekton Pipelines').openView();
    });

    it('Login to OpenShift', async function () {
      this.timeout(150000);
      const control = await new ActivityBar().getViewControl('OpenShift');
      await control.openView();
      await credentialsLogin(clusterUrl, driver, username, password);
      try {
        const saveNotification = await driver.wait(() => { return notificationExists('Do you want to save username and password?'); }, 20000);
        await saveNotification.takeAction('No');
      } catch (err) {
        console.log('Credentials already saved');
      }


      await driver.wait(() => { return notificationExists('Successfully logged in to'); }, 10000);
      // Check that the cluster node is present in the tree view
      await driver.wait(() => { return viewHasItems(); }, 5000);
      const item = await explorer.findItem(clusterUrl);
      expect(item).not.undefined;
    });
    
    it('Check Tekton View', async function() {
      this.timeout(200000);
      const control = new ActivityBar().getViewControl('Tekton Pipelines');
      await control.openView();
      const view = await new ActivityBar().getViewControl('Tekton Pipelines').openView();
      await driver.wait(() => { return viewHasItems(); }, 200000);
      explorer = await new SideBarView().getContent().getSection('Tekton Pipelines') as CustomTreeSection;
      const nodes = await explorer.getVisibleItems();
      const tektonSection = await new SideBarView().getContent().getSection('Tekton Pipelines') as CustomTreeSection;
      const items = await tektonSection.getVisibleItems();
      expect(items.length).equals(11);
    });

   
    it('Logout', async function() {
      this.timeout(20000);
      await new Workbench().executeCommand('OpenShift: Log out');
      const loginNotification = await driver.wait(() => { return notificationExists('Do you want to logout of cluster?'); }, 20000);
      await loginNotification.takeAction('Logout');
      const logoutNotification = await driver.wait(() => { return notificationExists('Successfully logged out. Do you want to login to a new cluster'); }, 20000);
      await logoutNotification.takeAction('No');
    });

  });
}

async function credentialsLogin(url: string, driver: WebDriver, user?: string, password?: string) {
  await new Workbench().executeCommand('OpenShift: Login into Cluster with credentials');

  try {
    const loginNotification = await driver.wait(() => { return notificationExists(notifications.LOGGED_IN); }, 10000);
    await loginNotification.takeAction('Yes');
  } catch (TimeoutError) {
    //swallow - 
  }
  await setInputTextAndConfirm(url, true);
  //TODO WAIT
  // input username
  await quickPick('Add new user...', true);
  const input = await new InputBox().wait();
  await driver.wait(() => {return inputHasNewMessage(input, 'Provide Username'); }, 10000);
  await setInputTextAndConfirm(user);

  // input password
  await driver.wait(() => {return inputHasNewMessage(input, 'Provide Password'); }, 10000);
  await setInputTextAndConfirm(password);
}
