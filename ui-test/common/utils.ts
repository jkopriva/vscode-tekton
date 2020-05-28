/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, EditorView, VSBrowser } from 'vscode-extension-tester';
import { commands, views } from './constants';
import { notificationCenterIsOpened } from './conditions';

export async function clearNotifications() {
  const driver = VSBrowser.instance.driver;
  try {
    const center = await new Workbench().openNotificationsCenter();
    await driver.wait(() => { return notificationCenterIsOpened(); }, 10000);
    await center.clearAllNotifications();
  } catch (err) {
    console.log(err);
    return null;
  }
}
