/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export declare namespace notifications {
	export const ATLASMAP_STARTING = 'Starting AtlasMap instance at port ';
	export const ATLASMAP_RUNNING = 'Running AtlasMap instance found';
	export const ATLASMAP_WAITING = 'Waiting for ';
	export const ATLASMAP_STOPPING = 'Stopping AtlasMap instance at port';
	export const ATLASMAP_STOPPED = 'Stopped AtlasMap instance at port';
	export const ATLASMAP_UNABLE_LOCATE = 'Unable to locate running AtlasMap instance';
}

export declare namespace commands {
	export const ABOUT_TEKTON = 'Tekton: About';
}

export declare namespace views {
	export const TEKTON_TITLE = 'Tekton';
}

export enum ItemType {
    application = 'Application',
    cluster = 'Cluster',
    component = 'Component',
    project = 'Project',
    service = 'Service',
    storage = 'Storage',
    url = 'URL'
}

export namespace notifications {
    export const ODO_NOT_FOUND = 'Cannot find OpenShift Do';
    export const OKD_NOT_FOUND = 'Cannot find OKD';
    export const SAVE_LOGIN = 'Do you want to save username and password?';
    export const LOGGED_IN = 'You are already logged in';
    export const CLONE_REPO = 'Do you want to clone git repository for created Component?';
    export const DOWNLOAD = 'Download and install';
}

export function itemCreated(type: ItemType, name: string) {
  return `${type} '${name}' successfully created`;
}

export function itemDeleted(type: ItemType, name: string) {
  return `${type} '${name}' successfully deleted`;
}

export function deleteItem(type: ItemType, name: string) {
  return `Do you want to delete ${type} '${name}'?`;
}
export function itemsLinked(fromItem: string, fromType: ItemType, toItem: string) {
  return `${fromType} '${fromItem}' successfully linked with ${ItemType.component} '${toItem}'`;
}
export function storageCreated(name: string, componentName: string) {
  return `${itemCreated(ItemType.storage, name)} for ${ItemType.component} '${componentName}'`;
}
export function itemFromComponentDeleted(name: string, type: ItemType, componentName: string) {
  return `${type} '${name}' from ${ItemType.component} '${componentName}' successfully deleted`;
}
export function urlCreated(name: string, component: string) {
  return `${ItemType.url} '${name}' for ${ItemType.component} '${component}' successfully created`;
}
