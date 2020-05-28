/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, NotificationType } from 'vscode-extension-tester';
import { views } from './constants';

export async function getNotificationWithMessage(message: string) {
  try {
    const center = await new Workbench().openNotificationsCenter();
    const notifications = await center.getNotifications(NotificationType.Any);
    for (const item of notifications) {
      const text = await item.getMessage();
      if (text.indexOf(message) > -1) {
        return item;
      }
    }
    return null;
  } catch (err) {
    //do not print err
    return null;
  }
}

export async function whilegetNotificationWithMessage(message: string) {
  return !(await getNotificationWithMessage(message));
}

export async function notificationCenterIsOpened(): Promise<boolean | undefined> {
  try {
    const center = await new Workbench().openNotificationsCenter();
    return await center.isDisplayed();
  } catch (err) {
    //do not print err
    return false;
  }
}
