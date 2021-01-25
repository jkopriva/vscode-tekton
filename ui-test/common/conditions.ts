/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Workbench, NotificationType, Notification, BottomBarPanel, TerminalView, OutputView, InputBox, SideBarView, Input, ViewItem, CustomTreeItem } from 'vscode-extension-tester';

export async function getNotificationWithMessage(message: string): Promise<Notification | undefined> {
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

export async function whilegetNotificationWithMessage(message: string): Promise<boolean | undefined> {
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

export async function notificationExists(text: string): Promise<Notification | undefined> {
  const notifications = await new Workbench().getNotifications();
  for (const notification of notifications) {
    const message = await notification.getMessage();
    if (message.includes(text)) {
      return notification;
    }
  }
}

export async function terminalChannelExists(text: string): Promise<string | undefined> {
  const terminalView = await new BottomBarPanel().openTerminalView();
  const names = await terminalView.getChannelNames();
  for (const name of names) {
    if (name.indexOf(text) >= 0) {
      return name;
    }
  }
  await terminalView.getDriver().sleep(2000);
  return null;
}

export async function outputChannelExists(text: string): Promise<string | undefined> {
  const outputView = await new BottomBarPanel().openOutputView();
  const names = await outputView.getChannelNames();
  for (const name of names) {
    if (name.indexOf(text) >= 0) {
      return name;
    }
  }
  await outputView.getDriver().sleep(2000);
  return null;
}


export async function terminalHasText(view: TerminalView, text: string, timePeriod = 2000): Promise<string | undefined> {
  await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
  const currentText = await view.getText();
  if (currentText.indexOf(text) > -1) {
    return text;
  } else {
    await view.getDriver().sleep(timePeriod);
    return null;
  }
}

export async function outputHasText(view: OutputView, text: string, timePeriod = 2000): Promise<string | undefined> {
  await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
  const currentText = await view.getText();
  if (currentText.indexOf(text) > -1) {
    return text;
  } else {
    await view.getDriver().sleep(timePeriod);
    return null;
  }
}


export async function inputHasNewMessage(input: InputBox, message: string, placeholder?: string) {
  const currentMessage = await input.getMessage();
  if (currentMessage && (currentMessage.includes(message))) {
    return true;
  }
  if (placeholder) {
    const currentHolder = await input.getPlaceHolder();
    return (placeholder !== currentHolder) && currentHolder;
  }
  return false;
}

export async function viewHasItems() {
  try {
    const explorer = await new SideBarView().getContent().getSection('Tekton Pipelines');
    const items = await explorer.getVisibleItems();
    if (items.length > 0) {
      return true;
    }
    return false;
  } catch (err){
    return false;
  }
}

export async function viewHasNoProgress(view: SideBarView) {
  const content = view.getContent();
  return !await content.hasProgress();
}

export async function inputHasQuickPicks(input: Input) {
  const picks = await input.getQuickPicks();
  if (picks.length > 0) {
    return picks;
  }
  return null;
}

export async function nodeHasNewChildren(node: CustomTreeItem, startChildren?: ViewItem[]) {
  try {
    if (!startChildren) {
      startChildren = await node.getChildren();
    }
    await node.getDriver().sleep(1000);
    const endChildren = await node.getChildren();
    if (startChildren.length === endChildren.length) {
      return null;
    }
    return endChildren;
  } catch (err) {
    await node.getDriver().sleep(500);
    return await node.getChildren();
  }
}