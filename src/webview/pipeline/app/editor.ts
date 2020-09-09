/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Trigger, Params, Workspaces, PipelineStart, NameType, PipelineRunWorkspaces } from './utils/types';
import { NavigationList, NavigationItem } from './widgets/navigation';
import { Widget } from './widgets/widget';
import { VolumeTypes, initialResourceFormValues, TknResourceType, typeOfResource } from './utils/const';
import { ButtonsPanel } from './widgets/buttonspanel';
import { Editor, GroupItem, EditItem } from './widgets/maincontent';
import { InputWidget } from './widgets/inputwidget';
import { SelectWidget } from './widgets/selectwidget';

export class PipelineRunEditor implements Widget {
  private element: HTMLElement;
  private buttonsPanel: ButtonsPanel;
  private editor: Editor;
  private navigation: NavigationList;
  public initialValue: PipelineStart = initialResourceFormValues;

  private navigationToGroupMap = new Map<NavigationItem, GroupItem>();

  constructor(private trigger: Trigger) {

    this.element = document.createElement('div');
    this.element.className = 'grid-container';

    this.navigation = new NavigationList();
    this.editor = new Editor();
    this.buttonsPanel = new ButtonsPanel('start', 'buttons', 'startButton', null, null, null, null, this.initialValue);

    this.element.appendChild(this.navigation.getElement());
    this.element.appendChild(this.editor.getElement());
    this.element.appendChild(this.buttonsPanel.getElement());
    this.navigation.setSelectionListener(this.onNavigationSelectChange.bind(this));
    this.editor.addSelectionListener(this.onEditorSelectionChange.bind(this));
    this.update();
  }

  createElement(title: string, resourceType: Params[] | PipelineRunWorkspaces[] | Workspaces[]): void {
    const resourceGroup = new GroupItem(title, `${title}-vscode-webview-pipeline`);
    this.initialValue.name = this.trigger.name;
    for (const resource of resourceType) {
      let element: Widget;
      let elementId: string;
      if (title === TknResourceType.Params) {
        elementId = `${TknResourceType.Params}-input-field-content-data`;
        element = new InputWidget('Name', null, this.initialValue, null, null, null, null, resource['default']);
      } else if (title === TknResourceType.Workspaces) {
        element = new SelectWidget('Workspaces-volume', this.trigger, null, this.initialValue).workspaces(VolumeTypes, resource);
      } else {
        element = new SelectWidget('Resources', null, null, this.initialValue).pipelineResource(this.trigger.pipelineResource, resource);
      }
      resourceGroup.addEditItem(new EditItem(resource.name, element, resource.name, null, elementId));
      //TODO: complete this
    }
    this.editor.addGroup(resourceGroup);
    const navigationItem = new NavigationItem(title);
    this.navigation.addItem(navigationItem);
    this.navigationToGroupMap.set(navigationItem, resourceGroup);
  }

  private update(): void {
    if (this.trigger.params) {
      this.createElement(TknResourceType.Params, this.trigger.params);
    }
    const gitResource = [];
    const imageResource = [];
    if (this.trigger.resources) {
      this.startPipeline(gitResource, imageResource);
    }
    if (this.trigger.workspaces) {
      this.createElement(TknResourceType.Workspaces, this.trigger.workspaces);
    }
    if (this.trigger.pipelineRun) {
      this.startPipelineRun();
    }
  }

  startPipelineRun(): void {
    this.paramPipelineRun();
    this.resourcePipelineRun();
    this.workspacePipelineRun();
  }

  paramPipelineRun(): void {
    if (this.trigger.pipelineRun.params.length !== 0) {
      this.trigger.pipelineRun.params.forEach(val => {
        if (val.value) {
          val.default = val.value;
        }
      });
      this.createElement(TknResourceType.Params, this.trigger.pipelineRun.params);
    }
  }

  resourcePipelineRun(): void {
    const gitResource = [];
    const imageResource = [];
    const pipelineRunResourceRef = {};
    if (this.trigger.pipelineRun.resources) {
      this.trigger.pipelineRun.resources.forEach(val => {
        try {
          pipelineRunResourceRef[val.resourceRef.name] = {
            resource: val.name
          };
        } catch (err) {
          if (val.type === typeOfResource.git) {
            gitResource.push(val);
          } else if (val.type === typeOfResource.image) {
            imageResource.push(val);
          }
        }
      });
      this.trigger.pipelineResource.forEach(val => {
        if (pipelineRunResourceRef[val.metadata.name]) {
          if (val.spec.type === typeOfResource.git) {
            gitResource.push({name: pipelineRunResourceRef[val.metadata.name].resource, type: val.spec.type, resourceRef: {name: val.metadata.name}});
          } else if (val.spec.type === typeOfResource.image) {
            imageResource.push({name: pipelineRunResourceRef[val.metadata.name].resource, type: val.spec.type, resourceRef: {name: val.metadata.name}});
          }
        }
      });
      if (gitResource.length !== 0) {
        this.createElement(TknResourceType.GitResource, gitResource);
      }

      if (imageResource.length !== 0) {
        this.createElement(TknResourceType.ImageResource, imageResource);
      }
    }
  }

  workspacePipelineRun(): void {
    if (this.trigger.pipelineRun.workspaces.length !== 0) {
      this.createElement(TknResourceType.Workspaces, this.trigger.pipelineRun.workspaces);
    }
  }

  startPipeline(gitResource: NameType[], imageResource: NameType[]): void {
    if (this.trigger.resources && this.trigger.resources.length !== 0) {
      this.trigger.resources.filter(val => {
        if (val.type === typeOfResource.git) {
          gitResource.push(val);
        } else if (val.type === typeOfResource.image) {
          imageResource.push(val)
        }
      });
      if (gitResource.length !== 0) {
        this.createElement(TknResourceType.GitResource, gitResource);
      }
      if (imageResource.length !== 0) {
        this.createElement(TknResourceType.ImageResource, imageResource);
      }
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private onNavigationSelectChange(item: NavigationItem): void {
    if (this.navigationToGroupMap.has(item)) {
      const group = this.navigationToGroupMap.get(item);
      group.getElement().scrollIntoView()
    }
  }

  private onEditorSelectionChange(item: GroupItem): void {
    for (const [nav, group] of this.navigationToGroupMap) {
      if (group === item) {
        this.navigation.selectItem(nav);
      }
    }
  }
}