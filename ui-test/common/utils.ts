/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, VSBrowser, BottomBarPanel, InputBox, Notification, NotificationType } from 'vscode-extension-tester';
import { notificationCenterIsOpened, inputHasNewMessage, inputHasQuickPicks } from './conditions';

export async function clearNotifications(): Promise<undefined> {
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

export async function findNotification(message: string): Promise<Notification> {
  const center = await new Workbench().openNotificationsCenter();

  for (const item of await center.getNotifications(NotificationType.Info)) {
    const text = await item.getMessage();
    if (text.indexOf(message) > -1) {
      return item;
    }
  }
}

export async function getTextFromTerminal(): Promise<string> {
  const terminalView = await new BottomBarPanel().openTerminalView();
  await terminalView.selectChannel('Tekton');
  const text = await terminalView.getText();
  return text;
}

export async function getTextFromOutput(): Promise<string> {
  const outputView = await new BottomBarPanel().openOutputView();
  await outputView.selectChannel('Tekton Pipelines');
  const text = await outputView.getText();
  return text;
}

export async function setInputTextAndConfirm(text?: string, shouldWait = false) {
  const input = await new InputBox().wait();
  const message = await input.getMessage();
  const holder = await input.getPlaceHolder();

  if (text) { await input.setText(text); }
  await input.confirm();

  if (shouldWait) {
    await input.getDriver().wait(() => { return inputHasNewMessage(input, message, holder); }, 3000);
  }
}

export async function quickPick(title: string, shouldWait = false) {
  const input = await new InputBox().wait();
  const driver = input.getDriver();
  await driver.wait(() => { return inputHasQuickPicks(input); }, 5000);
  const message = await input.getMessage();
  const placeHolder = await input.getPlaceHolder();
  await input.selectQuickPick(title);

  if (shouldWait) {
    await driver.wait(() => { return inputHasNewMessage(input, message, placeHolder); }, 5000);
  }
}
