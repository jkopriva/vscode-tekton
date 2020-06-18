/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { SideBarView, ActivityBar, WebDriver, VSBrowser, InputBox, until, By, ViewSection, Workbench, ViewItem, TreeItem } from 'vscode-extension-tester';
import { expect } from 'chai';
import * as path from 'path';
import { viewHasNoProgress, notificationExists, viewHasItems, inputHasNewMessage, nodeHasNewChildren } from '../common/conditions';
import { setInputTextAndConfirm, quickPick, findNotification } from '../common/utils';
import { notifications, ItemType, itemCreated, itemDeleted, deleteItem } from '../common/constants';

export function loginTest(clusterUrl: string): void {
  const username = process.env.OPENSHIFT_USERNAME ? process.env.OPENSHIFT_USERNAME : 'developer';
  const password = process.env.OPENSHIFT_PASSWORD ? process.env.OPENSHIFT_PASSWORD : 'developer';
  //const token = process.env.OPENSHIFT_TOKEN;

  describe('Login', () => {
    let driver: WebDriver;

    const projectName = 'pipelines-tutorial';
    const manifestTaskFile = '01_apply_manifest_task.yaml';
    const deploymentTaskFile = '02_update_deployment_task.yaml';
    const resourcesTaskFile = '03_resources.yaml';
    const pipelineTaskFile = '04_pipeline.yaml';

    before(async () => {
      driver = VSBrowser.instance.driver;
    });

    it('Login to OpenShift', async function () {
      this.timeout(150000);
      const view = new SideBarView();
      const control = await new ActivityBar().getViewControl('OpenShift');
      await control.openView();
      //(await (await view1.getTitlePart().getAction('Login into Cluster (⌃⇧L)')).click());
      //await driver.wait(() => { return notificationExists('Cannot find OpenShift Do'); }, 15000);
      await credentialsLogin(clusterUrl, driver, username, password);

      //await driver.wait(() => { return viewHasNoProgress(view); }, 90000);

      // Don't save the credentials
      try {
        const saveNotification = await driver.wait(() => { return notificationExists('Do you want to save username and password?'); }, 10000);
        await saveNotification.takeAction('No');
      } catch (err) {
        console.log('Credentials already saved');
      }


      await driver.wait(() => { return notificationExists('Successfully logged in to'); }, 10000);
      // Check that the cluster node is present in the tree view
      //await driver.wait(() => { return viewHasItems(explorer); }, 5000);
      //const item = await explorer.findItem(clusterUrl);
      //expect(item).not.undefined;
    });
    
    it('Create new project', async function() {
      this.timeout(20000);
      await new Workbench().executeCommand('OpenShift: New Project');
      //const input = await new InputBox().wait();
      //await driver.wait(() => {return inputHasNewMessage(input, 'Provide Project name'); }, 10000);

      await setInputTextAndConfirm(projectName);
      await driver.wait(() => { return notificationExists(itemCreated(ItemType.project, projectName)); }, 10000);
    });

    //it('Create pipeline resources', async function() {
    //  this.timeout(200000);
    //  await openAndApplyYaml(driver, projectName, manifestTaskFile);
    //   await openAndApplyYaml(driver, projectName, deploymentTaskFile);
    //  await openAndApplyYaml(driver, projectName, resourcesTaskFile);
    //  await openAndApplyYaml(driver, projectName, pipelineTaskFile);
    //});

    it('Delete project', async function() {
      this.timeout(20000);
      await new Workbench().executeCommand('OpenShift: Delete Project');
  
      await setInputTextAndConfirm(projectName);
      const deleteNotification = await driver.wait(() => { return notificationExists('Do you want to delete'); }, 10000);
      await deleteNotification.takeAction('Yes');
      await driver.wait(() => { return notificationExists(projectName); }, 10000);
    });

    it('Logout', async function() {
      this.timeout(20000);
      await new Workbench().executeCommand('OpenShift: Log out');
      await confirmLogout(driver);
    });

  });
}

async function openAndApplyYaml(driver: WebDriver, projectName: string, file: string){
  await new Workbench().executeCommand('Extest: Open File');
  await setInputTextAndConfirm(await getFilePath(file));
  await new Workbench().executeCommand('OpenShift: Create');
  await setInputTextAndConfirm(projectName);
  await driver.wait(() => { return notificationExists('Resources were successfully created.'); }, 20000);
}

async function confirmLogout(driver: WebDriver){
  const loginNotification = await driver.wait(() => { return notificationExists('Do you want to logout of cluster?'); }, 10000);
  await loginNotification.takeAction('Logout');
  const logoutNotification = await driver.wait(() => { return notificationExists('Successfully logged out. Do you want to login to a new cluster'); }, 10000);
  await logoutNotification.takeAction('No');
}

async function getFilePath(file: string){
  const resources = path.resolve('ui-test', 'resources');
  return path.join(resources, file);
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

async function handleNewProject(projectName: string, clusterNode: TreeItem) {
  //const input = await new InputBox().wait();
  //expect(await input.getMessage()).has.string('Provide Project name');


  await clusterNode.getDriver().wait(() => { return nodeHasNewChildren(clusterNode); }, 18000);
  const labels = [];
  for (const item of await clusterNode.getChildren()) {
    labels.push(item.getLabel());
  }

  expect(labels).contains(projectName);
}

