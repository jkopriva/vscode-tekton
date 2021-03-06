/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CliCommand, CliExitData, cli, createCliCommand, cliCommandToString } from './cli';
import { ProviderResult, TreeItemCollapsibleState, Terminal, Uri, workspace, TreeItem } from 'vscode';
import { WindowUtil } from './util/windowUtils';
import * as path from 'path';
import { ToolsConfig } from './tools';
import format = require('string-format');
import humanize = require('humanize-duration');
import { TknPipelineResource, TknTask, PipelineRunData } from './tekton';
import { kubectl } from './kubectl';
import { pipelineExplorer } from './pipeline/pipelineExplorer';
import { StartObject } from './tekton/pipelinecontent';

export const humanizer = humanize.humanizer(createConfig());

function createConfig(): humanize.HumanizerOptions {
  return {
    language: 'shortEn',
    languages: {
      shortEn: {
        y: () => 'y',
        mo: () => 'mo',
        w: () => 'w',
        d: () => 'd',
        h: () => 'h',
        m: () => 'm',
        s: () => 's',
        ms: () => 'ms',
      }
    },
    round: true,
    largest: 2,
    conjunction: ' '
  };
}


export interface TektonNode {
  contextValue: string;
  creationTime?: string;
  state?: string;
  visibleChildren?: number;
  getChildren(): ProviderResult<TektonNode[]>;
  getParent(): TektonNode | undefined;
  getName(): string;
  collapsibleState?: TreeItemCollapsibleState;
}

export enum ContextType {
  TASK = 'task',
  TASKRUN = 'taskrun',
  PIPELINE = 'pipeline',
  PIPELINERUN = 'pipelinerun',
  CLUSTERTASK = 'clustertask',
  TASKRUNNODE = 'taskrunnode',
  PIPELINENODE = 'pipelinenode',
  PIPELINERESOURCENODE = 'pipelineresourcenode',
  PIPELINERESOURCE = 'pipelineresource',
  TASKNODE = 'tasknode',
  CLUSTERTASKNODE = 'clustertasknode',
  TKN_DOWN = 'tknDown',
  TRIGGERTEMPLATESNODE = 'triggertemplatesnode',
  TRIGGERTEMPLATES = 'triggertemplates',
  TRIGGERBINDINGNODE = 'triggerbindingnode',
  TRIGGERBINDING = 'triggerbinding',
  CLUSTERTRIGGERBINDINGNODE = 'clustertriggerbindingnode',
  CLUSTERTRIGGERBINDING = 'clustertriggerbinding',
  EVENTLISTENERNODE = 'eventlistenernode',
  EVENTLISTENER = 'eventlistener',
  CONDITIONSNODE = 'conditionsnode',
  CONDITIONS = 'conditions',
  PIPELINERUNNODE = 'pipelinerunnode',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function verbose(_target: any, key: string, descriptor: any): void {
  let fnKey: string | undefined;
  let fn: Function;

  if (typeof descriptor.value === 'function') {
    fnKey = 'value';
    fn = descriptor.value;
  } else {
    throw new Error('not supported');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor[fnKey] = function (...args: any[]) {
    const v: number = workspace.getConfiguration('vs-tekton').get('outputVerbosityLevel');
    const command: CliCommand = fn.apply(this, args);
    if (v > 0) {
      command.cliArguments.push('-v', v.toString());
    }
    return command;
  };
}

function tknWorkspace(pipelineData: StartObject): string[] {
  const workspace: string[] = [];
  pipelineData.workspaces.forEach(element => {
    workspace.push('-w');
    if (element.workspaceType === 'PersistentVolumeClaim') {
      workspace.push(`name=${element.name},claimName=${element.workspaceName},subPath=${element.subPath}`);
    } else if (element.workspaceType === 'ConfigMap') {
      workspace.push(`name=${element.name},config=${element.workspaceName},item=${element.key}=${element.value}`);
    } else if (element.workspaceType === 'Secret') {
      workspace.push(`name=${element.name},secret=${element.workspaceName}`);
    } else if (element.workspaceType === 'EmptyDir') {
      workspace.push(`name=${element.name},emptyDir=${element.emptyDir}`);
    }
  });
  return workspace;
}

function newTknCommand(...tknArguments: string[]): CliCommand {
  return createCliCommand('tkn', ...tknArguments);
}

export function newK8sCommand(...k8sArguments): CliCommand {
  return createCliCommand('kubectl', ...k8sArguments);
}

export class Command {
  @verbose
  static listTaskRunsForTasks(task: string): CliCommand {
    return newK8sCommand('get', 'taskrun', '-l', `tekton.dev/task=${task}`, '-o', 'json');
  }

  @verbose
  static listTaskRunsForTasksInTerminal(task: string): CliCommand {
    return newTknCommand('taskrun', 'list', task);
  }

  @verbose
  static startPipeline(pipelineData: StartObject): CliCommand {
    const resources: string[] = [];
    const svcAcct: string[] = pipelineData.serviceAccount ? ['-s ', pipelineData.serviceAccount] : ['-s', 'pipeline'];
    pipelineData.resources.forEach(element => {
      resources.push('--resource');
      resources.push(element.name + '=' + element.resourceRef);
    });

    if (pipelineData.params.length === 0) {
      if (pipelineData.workspaces.length === 0) {
        return newTknCommand('pipeline', 'start', pipelineData.name, ...resources, ...svcAcct);
      } else {
        const workspace = tknWorkspace(pipelineData);
        return newTknCommand('pipeline', 'start', pipelineData.name, ...resources, ...workspace, ...svcAcct);
      }
    } else {
      const params: string[] = [];
      pipelineData.params.forEach(element => {
        params.push('--param');
        params.push(element.name + '=' + element.default);
      });
      if (pipelineData.workspaces.length === 0) {
        return newTknCommand('pipeline', 'start', pipelineData.name, ...resources, ...params, ...svcAcct);
      } else {
        const workspace = tknWorkspace(pipelineData);
        return newTknCommand('pipeline', 'start', pipelineData.name, ...resources, ...params, ...workspace, ...svcAcct);
      }
    }
  }
  @verbose
  static startTask(taskData: StartObject): CliCommand {
    const resources: string[] = [];
    const svcAcct: string[] = taskData.serviceAccount ? ['-s ', taskData.serviceAccount] : [];
    taskData.resources.forEach(element => {
      if (element.resourceType === 'inputs') {
        resources.push('-i');
        resources.push(element.name + '=' + element.resourceRef);
      } else if (element.resourceType === 'outputs') {
        resources.push('-o');
        resources.push(element.name + '=' + element.resourceRef);
      }
    });

    if (taskData.params.length === 0) {
      return newTknCommand('task', 'start', taskData.name, ...resources, ...svcAcct);
    }
    else {
      const params: string[] = [];
      taskData.params.forEach(element => {
        params.push('--param');
        params.push(element.name + '=' + element.default);
      });
      return newTknCommand('task', 'start', taskData.name, ...resources, ...params, ...svcAcct);
    }
  }
  @verbose
  static restartPipeline(name: string): CliCommand {
    return newTknCommand('pipeline', 'start', name, '--last', '-s', 'pipeline');
  }
  @verbose
  static deletePipeline(name: string): CliCommand {
    return newTknCommand('pipeline', 'delete', name, '-f');
  }
  @verbose
  static listPipelineResources(): CliCommand {
    return newK8sCommand('get', 'pipelineresources', '-o', 'json');
  }
  @verbose
  static listTriggerTemplates(): CliCommand {
    return newK8sCommand('get', 'triggertemplates', '-o', 'json');
  }
  @verbose
  static listTriggerBinding(): CliCommand {
    return newK8sCommand('get', 'triggerbinding', '-o', 'json');
  }
  static listClusterTriggerBinding(): CliCommand {
    return newK8sCommand('get', 'clustertriggerbinding', '-o', 'json');
  }
  @verbose
  static listEventListener(): CliCommand {
    return newK8sCommand('get', 'eventlistener', '-o', 'json');
  }
  static deleteTriggerTemplate(name: string): CliCommand {
    return newTknCommand('triggertemplate', 'delete', name, '-f');
  }
  static deleteTriggerBinding(name: string): CliCommand {
    return newTknCommand('triggerbinding', 'delete', name, '-f');
  }
  static deleteEventListeners(name: string): CliCommand {
    return newTknCommand('eventlistener', 'delete', name, '-f');
  }
  @verbose
  static listPipelineResourcesInTerminal(name: string): CliCommand {
    return newTknCommand('resource', 'list', name);
  }
  @verbose
  static describePipelineResource(name: string): CliCommand {
    return newTknCommand('resource', 'describe', name);
  }
  @verbose
  static deletePipelineResource(name: string): CliCommand {
    return newTknCommand('resource', 'delete', name, '-f');
  }
  @verbose
  static listPipelines(): CliCommand {
    return newK8sCommand('get', 'pipeline', '-o', 'json');
  }
  @verbose
  static listPipelinesInTerminal(name: string): CliCommand {
    return newTknCommand('pipeline', 'list', name);
  }
  @verbose
  static describePipelines(name: string): CliCommand {
    return newTknCommand('pipeline', 'describe', name);
  }
  @verbose
  static listPipelineRuns(name: string): CliCommand {
    return newK8sCommand('get', 'pipelinerun', '-l', `tekton.dev/pipeline=${name}`, '-o', 'json');
  }
  @verbose
  static listPipelineRunsInTerminal(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'list', name);
  }
  @verbose
  static describePipelineRuns(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'describe', name);
  }
  @verbose
  static cancelPipelineRun(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'cancel', name);
  }
  @verbose
  static deletePipelineRun(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'delete', name, '-f');
  }
  @verbose
  static showPipelineRunLogs(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'logs', name);
  }
  @verbose
  static listTasks(namespace?: string): CliCommand {
    return newK8sCommand('get', 'task', ...(namespace ? ['-n', namespace] : ''), '-o', 'json');
  }
  @verbose
  static listTasksInTerminal(namespace?: string): CliCommand {
    return newTknCommand('task', 'list', ...(namespace ? ['-n', namespace] : ''), '-o', 'json');
  }

  static listTaskRunsForPipelineRun(pipelineRunName: string): CliCommand {
    return newK8sCommand('get', 'taskrun', '-l', `tekton.dev/pipelineRun=${pipelineRunName}`, '-o', 'json');
  }

  static listTaskRunsForPipelineRunInTerminal(pipelineRunName: string): CliCommand {
    return newK8sCommand('get', 'taskrun', '-l', `tekton.dev/pipelineRun=${pipelineRunName}`);
  }

  @verbose
  static deleteTask(name: string): CliCommand {
    return newTknCommand('task', 'delete', name, '-f');
  }
  @verbose
  static listClusterTasks(namespace?: string): CliCommand {
    return newK8sCommand('get', 'clustertask', ...(namespace ? ['-n', namespace] : ''), '-o', 'json');
  }
  static listClusterTasksInTerminal(namespace?: string): CliCommand {
    return newTknCommand('clustertask', 'list', ...(namespace ? ['-n', namespace] : ''));
  }
  @verbose
  static deleteClusterTask(name: string): CliCommand {
    return newTknCommand('clustertask', 'delete', name, '-f');
  }
  @verbose
  static showTaskRunLogs(name: string): CliCommand {
    return newTknCommand('taskrun', 'logs', name);
  }
  @verbose
  static deleteTaskRun(name: string): CliCommand {
    return newTknCommand('taskrun', 'delete', name, '-f');
  }
  @verbose
  static printTknVersion(): CliCommand {
    return newTknCommand('version');
  }
  static showPipelineRunFollowLogs(name: string): CliCommand {
    return newTknCommand('pipelinerun', 'logs', name, '-f');
  }
  static showTaskRunFollowLogs(name: string): CliCommand {
    return newTknCommand('taskrun', 'logs', name, '-f');
  }
  static createPipelineResource(yamlFile: string): CliCommand {
    return newTknCommand('resource', 'create', '-f', yamlFile);
  }
  static checkTekton(): CliCommand {
    return newK8sCommand('auth', 'can-i', 'create', 'pipeline.tekton.dev', '&&', 'kubectl', 'get', 'pipeline.tekton.dev');
  }
  static updateYaml(fsPath: string): CliCommand {
    return newTknCommand('apply', '-f', fsPath);
  }
  static listTaskRun(): CliCommand {
    return newK8sCommand('get', 'taskrun', '-o', 'json');
  }
  static listConditions(): CliCommand {
    return newK8sCommand('get', 'conditions', '-o', 'json');
  }
  static listPipelineRun(): CliCommand {
    return newK8sCommand('get', 'pipelinerun', '-o', 'json');
  }
  static watchResources(resourceName: string, name: string): CliCommand {
    return newK8sCommand('get', resourceName, name, '-w', '-o', 'json');
  }
  static workspace(name: string): CliCommand {
    return newK8sCommand('get', name, '-o', 'json');
  }
  static getPipelineResource(): CliCommand {
    return newK8sCommand('get', 'pipelineresources', '-o', 'json');
  }
  static create(file: string): CliCommand {
    return newK8sCommand('create', '--save-config','-f', file);
  }
}

export class TektonNodeImpl implements TektonNode {
  private readonly CONTEXT_DATA = {
    pipelinenode: {
      icon: 'PL.svg',
      tooltip: 'Pipelines: {label}',
      getChildren: () => this.tkn.getPipelines(this)
    },
    pipelinerunnode: {
      icon: 'PLR.svg',
      tooltip: 'PipelineRuns: {label}',
      getChildren: () => this.tkn.getPipelineRunsList(this)
    },
    pipelineresourcenode: {
      icon: 'PR.svg',
      tooltip: 'PipelineResources: {label}',
      getChildren: () => this.tkn.getPipelineResources(this)
    },
    pipelineresource: {
      icon: 'PR.svg',
      tooltip: 'PipelineResources: {label}',
      getChildren: () => []
    },
    tasknode: {
      icon: 'T.svg',
      tooltip: 'Tasks: {label}',
      getChildren: () => this.tkn.getTasks(this)
    },
    clustertasknode: {
      icon: 'CT.svg',
      tooltip: 'ClusterTasks: {label}',
      getChildren: () => this.tkn.getClusterTasks(this)
    },
    pipeline: {
      icon: 'PL.svg',
      tooltip: 'Pipeline: {label}',
      getChildren: () => this.tkn.getPipelineRuns(this)
    },
    pipelinerun: {
      icon: 'running.gif',
      tooltip: 'PipelineRun: {label}',
      getChildren: () => this.tkn.getTaskRunsForPipelineRun(this)
    },
    task: {
      icon: 'T.svg',
      tooltip: 'Task: {label}',
      getChildren: () => this.tkn.getTaskRunsForTasks(this)
    },
    taskrun: {
      icon: 'running.gif',
      tooltip: 'TaskRun: {label}',
      getChildren: () => []
    },
    clustertask: {
      icon: 'CT.svg',
      tooltip: 'Clustertask: {label}',
      getChildren: () => this.tkn.getTaskRunsForTasks(this)
    },
    tknDown: {
      icon: 'tkn-down.png',
      tooltip: 'Cannot connect to the tekton',
      getChildren: () => []
    },
    triggertemplatesnode: {
      icon: 'TT.svg',
      tooltip: 'TriggerTemplates: {label}',
      getChildren: () => this.tkn.getTriggerTemplates(this)
    },
    triggertemplates: {
      icon: 'TT.svg',
      tooltip: 'TriggerTemplates: {label}',
      getChildren: () => []
    },
    triggerbindingnode: {
      icon: 'TB.svg',
      tooltip: 'TriggerBinding: {label}',
      getChildren: () => this.tkn.getTriggerBinding(this)
    },
    triggerbinding: {
      icon: 'TB.svg',
      tooltip: 'TriggerBinding: {label}',
      getChildren: () => []
    },
    clustertriggerbindingnode: {
      icon: 'CTB.svg',
      tooltip: 'ClusterTriggerBinding: {label}',
      getChildren: () => this.tkn.getClusterTriggerBinding(this)
    },
    clustertriggerbinding: {
      icon: 'CTB.svg',
      tooltip: 'ClusterTriggerBinding: {label}',
      getChildren: () => []
    },
    eventlistenernode: {
      icon: 'EL.svg',
      tooltip: 'EventListener: {label}',
      getChildren: () => this.tkn.getEventListener(this)
    },
    eventlistener: {
      icon: 'EL.svg',
      tooltip: 'EventListener: {label}',
      getChildren: () => []
    },
    conditionsnode: {
      icon: 'C.svg',
      tooltip: 'Conditions: {label}',
      getChildren: () => this.tkn.getConditions(this)
    },
    conditions: {
      icon: 'C.svg',
      tooltip: 'Conditions: {label}',
      getChildren: () => []
    },
    taskrunnode: {
      icon: 'TR.svg',
      tooltip: 'TaskRuns: {label}',
      getChildren: () => this.tkn.getTaskRunList(this)
    },
  };

  constructor(private parent: TektonNode,
    public readonly name: string,
    public readonly contextValue: ContextType,
    private readonly tkn: Tkn,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed,
    public readonly creationTime?: string,
    public readonly state?: string) {

  }

  get iconPath(): Uri {
    if (this.state) {
      let fileName = 'running.gif';
      if (this.state) {
        switch (this.state) {
          case 'False': {
            fileName = 'failed.png';
            break;
          }
          case 'True': {
            fileName = 'success.png';
            break;
          }
          default: {
            break;
          }
        }
      }
      return Uri.file(path.join(__dirname, '../../images', fileName));
    }
    return Uri.file(path.join(__dirname, '../../images', this.CONTEXT_DATA[this.contextValue].icon));
  }

  get tooltip(): string {
    return format(this.CONTEXT_DATA[this.contextValue].tooltip, this);
  }

  get label(): string {
    return this.name;
  }

  getName(): string {
    return this.name;
  }

  getChildren(): ProviderResult<TektonNode[]> {
    return this.CONTEXT_DATA[this.contextValue].getChildren();
  }

  getParent(): TektonNode {
    return this.parent;
  }

}

type PipelineTaskRunData = {
  metadata?: {
    creationTimestamp: string;
    name: string;
    labels: {
      'tekton.dev/pipelineTask': string;
      'tekton.dev/pipelineRun': string;
    };
  };
  status?: {
    completionTime: string;
    conditions: [{
      status: string;
    }];
  };
  spec: {
    taskRef: {
      name: string;
    };
  };
};


export class TaskRun extends TektonNodeImpl {
  private started: string;
  private finished: string;
  private shortName: string;
  constructor(parent: TektonNode,
    name: string,
    tkn: Tkn,
    item: PipelineTaskRunData) {
    super(parent, name, ContextType.TASKRUN, tkn, TreeItemCollapsibleState.None, item.metadata.creationTimestamp, item.status ? item.status.conditions[0].status : '');
    this.started = item.metadata.creationTimestamp;
    this.shortName = item.metadata.labels['tekton.dev/pipelineTask'];
    this.finished = item.status?.completionTime;
  }

  get label(): string {
    return this.shortName ? this.shortName : this.name;
  }

  get description(): string {
    let r = '';
    if (this.getParent().contextValue === ContextType.TASK) {
      if (this.finished) {
        r = 'started ' + humanizer(Date.now() - Date.parse(this.started)) + ' ago, finished in ' + humanizer(Date.parse(this.finished) - Date.parse(this.started));
      } else {
        r = 'started ' + humanizer(Date.now() - Date.parse(this.started)) + ' ago, running for ' + humanizer(Date.now() - Date.parse(this.started));
      }
    } else {
      if (this.finished) {
        r = 'finished in ' + humanizer(Date.parse(this.finished) - Date.parse(this.started));
      } else {
        r = 'running for ' + humanizer(Date.now() - Date.parse(this.started));
      }
    }
    return r;
  }
}


export class PipelineRun extends TektonNodeImpl {
  private started: string;
  private finished: string;
  private generateName: string;
  constructor(parent: TektonNode,
    name: string,
    tkn: Tkn,
    item: PipelineRunData, collapsibleState: TreeItemCollapsibleState) {
    super(parent, name, ContextType.PIPELINERUN, tkn, collapsibleState, item.metadata.creationTimestamp, item.status ? item.status.conditions[0].status : '');
    this.started = item.metadata.creationTimestamp;
    this.generateName = item.metadata.generateName;
    this.finished = item.status?.completionTime;
  }

  get label(): string {
    return this.name;
  }

  get description(): string {
    let r = '';
    if (this.finished) {
      r = 'started ' + humanizer(Date.now() - Date.parse(this.started)) + ' ago, finished in ' + humanizer(Date.parse(this.finished) - Date.parse(this.started));
    } else {
      r = 'running for ' + humanizer(Date.now() - Date.parse(this.started));
    }
    return r;
  }
}

export class MoreNode extends TreeItem implements TektonNode {
  contextValue: string;
  creationTime?: string;
  state?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
  label: string;

  constructor(private showNext: number,
    private totalCount: number,
    private parent: TektonNode) {
    super('more', TreeItemCollapsibleState.None);
    this.command = { command: '_tekton.explorer.more', title: `more ${this.showNext}`, arguments: [this.showNext, this.parent] };
  }

  get tooltip(): string {
    return `${this.showNext} more from ${this.totalCount}`
  }

  get description(): string {
    return `${this.showNext} from ${this.totalCount}`
  }

  getChildren(): ProviderResult<TektonNode[]> {
    throw new Error('Method not implemented.');
  }
  getParent(): TektonNode {
    return this.parent;
  }
  getName(): string {
    return this.label;
  }

}

export interface Tkn {
  getPipelineNodes(): Promise<TektonNode[]>;
  startPipeline(pipeline: StartObject): Promise<TektonNode[]>;
  startTask(task: StartObject): Promise<TektonNode[]>;
  restartPipeline(pipeline: TektonNode): Promise<void>;
  getPipelines(pipeline: TektonNode): Promise<TektonNode[]>;
  getPipelineRuns(pipelineRun: TektonNode): Promise<TektonNode[]>;
  getPipelineResources(pipelineResources: TektonNode): Promise<TektonNode[]>;
  getTasks(task: TektonNode): Promise<TektonNode[]>;
  getRawTasks(): Promise<TknTask[]>;
  getTaskRunsForPipelineRun(taskRun: TektonNode): Promise<TektonNode[]>;
  getClusterTasks(clustertask: TektonNode): Promise<TektonNode[]>;
  getRawClusterTasks(): Promise<TknTask[]>;
  execute(command: CliCommand, cwd?: string, fail?: boolean): Promise<CliExitData>;
  executeInTerminal(command: CliCommand, cwd?: string): void;
  getTaskRunsForTasks(task: TektonNode): Promise<TektonNode[]>;
  getTriggerTemplates(triggerTemplates: TektonNode): Promise<TektonNode[]>;
  getTriggerBinding(triggerBinding: TektonNode): Promise<TektonNode[]>;
  getClusterTriggerBinding(clusterTriggerBinding: TektonNode): Promise<TektonNode[]>;
  getEventListener(EventListener: TektonNode): Promise<TektonNode[]>;
  getConditions(conditions: TektonNode): Promise<TektonNode[]>;
  getPipelineRunsList(pipelineRun: TektonNode): Promise<TektonNode[]>;
  getTaskRunList(taskRun: TektonNode): Promise<TektonNode[]>;
  clearCache?(): void;
}

function compareNodes(a, b): number {
  if (!a.contextValue) { return -1; }
  if (!b.contextValue) { return 1; }
  const t = a.contextValue.localeCompare(b.contextValue);
  return t ? t : a.label.localeCompare(b.label);
}

function compareTimeNewestFirst(a: TektonNode, b: TektonNode): number {
  const aTime = Date.parse(a.creationTime);
  const bTime = Date.parse(b.creationTime);
  return aTime < bTime ? 1 : -1;
}

export function getStderrString(data: string | Error): string {
  if (data instanceof Error) {
    return data.message;
  } else if ((typeof data === 'string')) {
    return data;
  }
}
const nodeToRefresh = ['TaskRuns', 'ClusterTasks', 'Tasks'];
export class TknImpl implements Tkn {

  public static ROOT: TektonNode = new TektonNodeImpl(undefined, 'root', undefined, undefined);

  // Get page size from configuration, in case configuration is not present(dev mode) use hard coded value
  defaultPageSize: number = workspace.getConfiguration('vs-tekton').has('treePaginationLimit') ? workspace.getConfiguration('vs-tekton').get('treePaginationLimit') : 5;

  async getPipelineNodes(): Promise<TektonNode[]> {
    const result: CliExitData = await this.execute(
      Command.checkTekton(), process.cwd(), false
    );
    if (result.stdout.trim() === 'no') {
      const tknDownMsg = 'The current user doesn\'t have the privileges to interact with tekton resources.';
      return [new TektonNodeImpl(null, tknDownMsg, ContextType.TKN_DOWN, this, TreeItemCollapsibleState.None)];
    }
    if (result.error && getStderrString(result.error).indexOf('You must be logged in to the server (Unauthorized)') > -1) {
      const tknMessage = 'Please login to the server.';
      return [ new TektonNodeImpl(null, tknMessage, ContextType.TKN_DOWN, this, TreeItemCollapsibleState.None)]
    }
    if (result.error && getStderrString(result.error).indexOf('the server doesn\'t have a resource type \'pipeline\'') > -1) {
      const tknDownMsg = 'Please install the OpenShift Pipelines Operator.';
      return [new TektonNodeImpl(null, tknDownMsg, ContextType.TKN_DOWN, this, TreeItemCollapsibleState.None)];
    }
    const serverCheck = RegExp('Unable to connect to the server');
    if (serverCheck.test(getStderrString(result.error))) {
      const loginError = 'Unable to connect to OpenShift cluster, is it down?';
      return [new TektonNodeImpl(null, loginError, ContextType.TKN_DOWN, this, TreeItemCollapsibleState.None)];
    }

    return this._getPipelineNodes();
  }

  public _getPipelineNodes(): TektonNode[] {
    const pipelineTree: TektonNode[] = [];
    const pipelineNode = new TektonNodeImpl(TknImpl.ROOT, 'Pipelines', ContextType.PIPELINENODE, this, TreeItemCollapsibleState.Collapsed);
    const pipelineRunNode = new TektonNodeImpl(TknImpl.ROOT, 'PipelineRuns', ContextType.PIPELINERUNNODE, this, TreeItemCollapsibleState.Collapsed);
    const taskNode = new TektonNodeImpl(TknImpl.ROOT, 'Tasks', ContextType.TASKNODE, this, TreeItemCollapsibleState.Collapsed);
    const clustertaskNode = new TektonNodeImpl(TknImpl.ROOT, 'ClusterTasks', ContextType.CLUSTERTASKNODE, this, TreeItemCollapsibleState.Collapsed);
    const taskRunNode = new TektonNodeImpl(TknImpl.ROOT, 'TaskRuns', ContextType.TASKRUNNODE, this, TreeItemCollapsibleState.Collapsed);
    const pipelineResourceNode = new TektonNodeImpl(TknImpl.ROOT, 'PipelineResources', ContextType.PIPELINERESOURCENODE, this, TreeItemCollapsibleState.Collapsed);
    const triggerTemplatesNode = new TektonNodeImpl(TknImpl.ROOT, 'TriggerTemplates', ContextType.TRIGGERTEMPLATESNODE, this, TreeItemCollapsibleState.Collapsed);
    const triggerBindingNode = new TektonNodeImpl(TknImpl.ROOT, 'TriggerBinding', ContextType.TRIGGERBINDINGNODE, this, TreeItemCollapsibleState.Collapsed);
    const eventListenerNode = new TektonNodeImpl(TknImpl.ROOT, 'EventListener', ContextType.EVENTLISTENERNODE, this, TreeItemCollapsibleState.Collapsed);
    const clusterTriggerBindingNode = new TektonNodeImpl(TknImpl.ROOT, 'ClusterTriggerBinding', ContextType.CLUSTERTRIGGERBINDINGNODE, this, TreeItemCollapsibleState.Collapsed);
    const conditionsNode = new TektonNodeImpl(TknImpl.ROOT, 'Conditions', ContextType.CONDITIONSNODE, this, TreeItemCollapsibleState.Collapsed);
    pipelineTree.push(pipelineNode, pipelineRunNode, taskNode, clustertaskNode, taskRunNode, pipelineResourceNode, triggerTemplatesNode, triggerBindingNode, eventListenerNode, conditionsNode, clusterTriggerBindingNode);
    TknImpl.ROOT.getChildren = () => pipelineTree; // TODO: fix me
    return pipelineTree;
  }

  async refreshPipelineRun(tknResource: TektonNode, resourceName: string): Promise<void> {
    await kubectl.watchRunCommand(Command.watchResources(resourceName, tknResource.getName()), () => {
      if (tknResource.contextValue === 'pipelinerun') {
        pipelineExplorer.refresh(tknResource);
        for (const item of TknImpl.ROOT.getChildren() as TektonNodeImpl[]) {
          if (nodeToRefresh.includes(item.getName())) {
            pipelineExplorer.refresh(item);
          }
        }
      }
    });
    (tknResource.contextValue === 'taskrun') ? pipelineExplorer.refresh(tknResource.getParent()) : pipelineExplorer.refresh(); // refresh all tree
  }

  async getPipelineStatus(listOfResources: TektonNode[]): Promise<void> {
    for (const tknResource of listOfResources) {
      if (tknResource.state === 'Unknown') {
        this.refreshPipelineRun(tknResource, tknResource.contextValue);
      }
    }
  }

  async limitView(context: TektonNode, tektonNode: TektonNode[]): Promise<TektonNode[]> {
    const currentRuns = tektonNode.slice(0, Math.min(context.visibleChildren, tektonNode.length))
    if (context.visibleChildren < tektonNode.length) {
      let nextPage = this.defaultPageSize;
      if (context.visibleChildren + this.defaultPageSize > tektonNode.length) {
        nextPage = tektonNode.length - context.visibleChildren;
      }
      currentRuns.push(new MoreNode(nextPage, tektonNode.length, context));
    }
    return currentRuns;
  }

  async getPipelineRunsList(pipelineRun: TektonNode): Promise<TektonNode[]> {
    if (!pipelineRun.visibleChildren) {
      pipelineRun.visibleChildren = this.defaultPageSize;
    }
    const pipelineRunList = await this._getPipelineRunsList(pipelineRun);
    return this.limitView(pipelineRun, pipelineRunList);
  }

  async _getPipelineRunsList(pipelineRun: TektonNode): Promise<TektonNode[]> | undefined {
    const result = await this.execute(Command.listPipelineRun());
    if (result.error) {
      console.log(result + ' Std.err when processing pipelines');
      return [new TektonNodeImpl(pipelineRun, getStderrString(result.error), ContextType.PIPELINERUNNODE, this, TreeItemCollapsibleState.None)];
    }

    let data: PipelineRunData[] = [];
    try {
      const r = JSON.parse(result.stdout);
      data = r.items ? r.items : data;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data.map((value) => new PipelineRun(pipelineRun, value.metadata.name, this, value, TreeItemCollapsibleState.None)).sort(compareTimeNewestFirst);
  }

  async getPipelineRuns(pipeline: TektonNode): Promise<TektonNode[]> {
    if (!pipeline.visibleChildren) {
      pipeline.visibleChildren = this.defaultPageSize;
    }

    const pipelineRuns = await this._getPipelineRuns(pipeline);

    this.getPipelineStatus(pipelineRuns);
    return this.limitView(pipeline, pipelineRuns);
  }

  async _getPipelineRuns(pipeline: TektonNode): Promise<TektonNode[]> | undefined {
    const result = await this.execute(Command.listPipelineRuns(pipeline.getName()));
    if (result.error) {
      console.log(result + ' Std.err when processing pipelines');
      return [new TektonNodeImpl(pipeline, getStderrString(result.error), ContextType.PIPELINERUN, this, TreeItemCollapsibleState.None)];
    }

    let data: PipelineRunData[] = [];
    try {
      const r = JSON.parse(result.stdout);
      data = r.items ? r.items : data;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data
      .map((value) => new PipelineRun(pipeline, value.metadata.name, this, value, TreeItemCollapsibleState.Expanded))
      .sort(compareTimeNewestFirst);
  }

  async getTaskRunsForTasks(task: TektonNode): Promise<TektonNode[]> {
    if (!task.visibleChildren) {
      task.visibleChildren = this.defaultPageSize;
    }
    const taskRun = await this._getTaskRunsForTasks(task);
    this.getPipelineStatus(taskRun);
    return this.limitView(task, taskRun);
  }

  async _getTaskRunsForTasks(task: TektonNode): Promise<TektonNode[]> {
    const result = await this.execute(Command.listTaskRunsForTasks(task.getName()));
    if (result.error) {
      console.log(result + ' Std.err when processing taskruns for ' + task.getName());
      return [new TektonNodeImpl(task, getStderrString(result.error), ContextType.TASKRUN, this, TreeItemCollapsibleState.None)];
    }
    let data: PipelineTaskRunData[] = [];
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }
    return data
      .map((value) => new TaskRun(task, value.metadata.name, this, value))
      .sort(compareTimeNewestFirst);
  }

  async getTaskRunList(taskRun: TektonNode): Promise<TektonNode[]> {
    if (!taskRun.visibleChildren) {
      taskRun.visibleChildren = this.defaultPageSize;
    }
    const taskRunList = await this._getTaskRunList(taskRun);
    return this.limitView(taskRun, taskRunList);
  }

  async _getTaskRunList(taskRun: TektonNode): Promise<TektonNode[]> | undefined {
    const result = await this.execute(Command.listTaskRun());
    if (result.error) {
      return [new TektonNodeImpl(taskRun, getStderrString(result.error), ContextType.TASKRUNNODE, this, TreeItemCollapsibleState.None)];
    }

    let data: PipelineTaskRunData[] = [];
    try {
      const r = JSON.parse(result.stdout);
      data = r.items ? r.items : data;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data.map((value) => new TaskRun(taskRun, value.metadata.name, this, value)).sort(compareTimeNewestFirst);
  }

  async getTaskRunsForPipelineRun(pipelineRun: TektonNode): Promise<TektonNode[]> {
    if (!pipelineRun.visibleChildren) {
      pipelineRun.visibleChildren = this.defaultPageSize;
    }

    const taskRuns = await this._getTaskRunsForPipelineRun(pipelineRun);

    return this.limitView(pipelineRun, taskRuns);
  }

  async _getTaskRunsForPipelineRun(pipelinerun: TektonNode): Promise<TektonNode[]> {
    const result = await this.execute(Command.listTaskRunsForPipelineRun(pipelinerun.getName()));
    if (result.error) {
      console.log(result + ' Std.err when processing pipelines');
      return [new TektonNodeImpl(pipelinerun, getStderrString(result.error), ContextType.TASKRUN, this, TreeItemCollapsibleState.Expanded)];
    }
    let data: PipelineTaskRunData[] = [];
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data
      .map((value) => new TaskRun(pipelinerun, value.metadata.name, this, value))
      .sort(compareTimeNewestFirst);
  }

  async getPipelines(pipeline: TektonNode): Promise<TektonNode[]> {
    return this._getPipelines(pipeline);
  }

  async _getPipelines(pipeline: TektonNode): Promise<TektonNode[]> {
    let data: TknTask[] = [];
    const result = await this.execute(Command.listPipelines(), process.cwd(), false);
    if (result.error) {
      console.log(result + ' Std.err when processing pipelines');
      return [new TektonNodeImpl(pipeline, getStderrString(result.error), ContextType.PIPELINE, this, TreeItemCollapsibleState.Expanded)];
    }
    try {
      data = JSON.parse(result.stdout).items;
    } catch (ignore) {
      //show no pipelines if output is not correct json
    }
    let pipelines: string[] = data.map((value) => value.metadata.name);
    pipelines = [...new Set(pipelines)];
    const treeState = pipelines.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;
    return pipelines.map<TektonNode>((value) => new TektonNodeImpl(pipeline, value, ContextType.PIPELINE, this, treeState)).sort(compareNodes);
  }

  async getPipelineResources(pipelineResources: TektonNode): Promise<TektonNode[]> {
    return this._getPipelineResources(pipelineResources);
  }

  private async _getPipelineResources(pipelineResource: TektonNode): Promise<TektonNode[]> {
    let data: TknPipelineResource[] = [];
    const result = await this.execute(Command.listPipelineResources(), process.cwd(), false);
    if (result.error) {
      console.log(result + ' Std.err when processing pipelines');
      return [new TektonNodeImpl(pipelineResource, getStderrString(result.error), ContextType.PIPELINERESOURCE, this, TreeItemCollapsibleState.Expanded)];
    }
    try {
      data = JSON.parse(result.stdout).items;
    } catch (ignore) {
      //show no pipelines if output is not correct json
    }
    const pipelineresources: string[] = data.map((value) => value.metadata.name);
    return pipelineresources.map<TektonNode>((value) => new TektonNodeImpl(pipelineResource, value, ContextType.PIPELINERESOURCE, this, TreeItemCollapsibleState.None)).sort(compareNodes);
  }

  async getConditions(conditionsNode: TektonNode): Promise<TektonNode[]> {
    return this._getConditions(conditionsNode, Command.listConditions(), ContextType.CONDITIONS);
  }

  private async _getConditions(conditionResource: TektonNode, command: CliCommand, conditionContextType: ContextType): Promise<TektonNode[]> {
    let data: TknPipelineResource[] = [];
    const result = await this.execute(command, process.cwd(), false);
    if (result.error) {
      return [new TektonNodeImpl(conditionResource, getStderrString(result.error), conditionContextType, this, TreeItemCollapsibleState.Expanded)];
    }
    try {
      data = JSON.parse(result.stdout).items;
    } catch (ignore) {
      //show no pipelines if output is not correct json
    }
    let condition: string[] = data.map((value) => value.metadata.name);
    condition = [...new Set(condition)];
    return condition.map<TektonNode>((value) => new TektonNodeImpl(conditionResource, value, conditionContextType, this, TreeItemCollapsibleState.None)).sort(compareNodes);
  }

  async getTriggerTemplates(triggerTemplatesNode: TektonNode): Promise<TektonNode[]> {
    return this._getTriggerResource(triggerTemplatesNode, Command.listTriggerTemplates(), ContextType.TRIGGERTEMPLATES);
  }

  async getTriggerBinding(triggerBindingNode: TektonNode): Promise<TektonNode[]> {
    return this._getTriggerResource(triggerBindingNode, Command.listTriggerBinding(), ContextType.TRIGGERBINDING);
  }

  async getEventListener(eventListenerNode: TektonNode): Promise<TektonNode[]> {
    return this._getTriggerResource(eventListenerNode, Command.listEventListener(), ContextType.EVENTLISTENER);
  }

  async getClusterTriggerBinding(clusterTriggerBindingNode: TektonNode): Promise<TektonNode[]> {
    return this._getTriggerResource(clusterTriggerBindingNode, Command.listClusterTriggerBinding(), ContextType.CLUSTERTRIGGERBINDING);
  }

  private async _getTriggerResource(trigerResource: TektonNode, command: CliCommand, triggerContextType: ContextType): Promise<TektonNode[]> {
    let data: TknPipelineResource[] = [];
    const result = await this.execute(command, process.cwd(), false);
    if (result.error) {
      return [new TektonNodeImpl(trigerResource, getStderrString(result.error), triggerContextType, this, TreeItemCollapsibleState.Expanded)];
    }
    try {
      data = JSON.parse(result.stdout).items;
    } catch (ignore) {
      //show no pipelines if output is not correct json
    }
    let trigger: string[] = data.map((value) => value.metadata.name);
    trigger = [...new Set(trigger)];
    return trigger.map<TektonNode>((value) => new TektonNodeImpl(trigerResource, value, triggerContextType, this, TreeItemCollapsibleState.None)).sort(compareNodes);
  }

  public async getTasks(task: TektonNode): Promise<TektonNode[]> {
    return this._getTasks(task);
  }

  async _getTasks(task: TektonNode): Promise<TektonNode[]> {
    let data: TknTask[] = [];
    const result = await this.execute(Command.listTasks());
    if (result.error) {
      console.log(result + 'Std.err when processing tasks');
      return [new TektonNodeImpl(task, getStderrString(result.error), ContextType.TASK, this, TreeItemCollapsibleState.Expanded)];
    }
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }
    let tasks: string[] = data.map((value) => value.metadata.name);
    tasks = [...new Set(tasks)];
    return tasks.map<TektonNode>((value) => new TektonNodeImpl(task, value, ContextType.TASK, this, TreeItemCollapsibleState.Collapsed)).sort(compareNodes);
  }

  async getRawTasks(): Promise<TknTask[]> {
    let data: TknTask[] = [];
    const result = await this.execute(Command.listTasks());
    if (result.error) {
      console.log(result + 'Std.err when processing tasks');
      return data;
    }
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data;
  }

  async getClusterTasks(clustertask: TektonNode): Promise<TektonNode[]> {
    return this._getClusterTasks(clustertask);
  }

  async _getClusterTasks(clustertask: TektonNode): Promise<TektonNode[]> {
    let data: TknTask[] = [];
    try {
      const result = await this.execute(Command.listClusterTasks());
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {

    }
    let tasks: string[] = data.map((value) => value.metadata.name);
    tasks = [...new Set(tasks)];
    return tasks.map<TektonNode>((value) => new TektonNodeImpl(clustertask, value, ContextType.CLUSTERTASK, this, TreeItemCollapsibleState.Collapsed)).sort(compareNodes);
  }

  async getRawClusterTasks(): Promise<TknTask[]> {
    let data: TknTask[] = [];
    const result = await this.execute(Command.listClusterTasks());
    if (result.error) {
      console.log(result + 'Std.err when processing tasks');
      return data;
    }
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }

    return data;
  }

  async startPipeline(pipeline: StartObject): Promise<TektonNode[]> {
    const result = await this.execute(Command.startPipeline(pipeline));
    let data: TknTask[] = [];
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {

    }
    let pipelines: string[] = data.map((value) => value.metadata.name);
    pipelines = [...new Set(pipelines)];
    const treeState = pipelines.length > 0 ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed;
    return pipelines.map<TektonNode>((value) => new TektonNodeImpl(undefined, value, ContextType.PIPELINE, this, treeState)).sort(compareNodes);
  }

  async startTask(task: StartObject): Promise<TektonNode[]> {
    const result = await this.execute(Command.startTask(task));
    let data: TknTask[] = [];
    try {
      data = JSON.parse(result.stdout).items;
      // eslint-disable-next-line no-empty
    } catch (ignore) {
    }
    let tasks: string[] = data.map((value) => value.metadata.name);
    tasks = [...new Set(tasks)];
    return tasks.map<TektonNode>((value) => new TektonNodeImpl(undefined, value, ContextType.PIPELINE, this, TreeItemCollapsibleState.None)).sort(compareNodes);
  }

  async restartPipeline(pipeline: TektonNode): Promise<void> {
    await this.executeInTerminal(Command.restartPipeline(pipeline.getName()));
  }

  async executeInTerminal(command: CliCommand, cwd: string = process.cwd(), name = 'Tekton'): Promise<void> {
    let toolLocation = await ToolsConfig.detectOrDownload();
    if (toolLocation) {
      toolLocation = path.dirname(toolLocation);
    }
    const terminal: Terminal = WindowUtil.createTerminal(name, cwd, toolLocation);
    terminal.sendText(cliCommandToString(command), true);
    terminal.show();
  }

  async execute(command: CliCommand, cwd?: string, fail = true): Promise<CliExitData> {
    if (command.cliCommand.indexOf('tkn') >= 0) {
      const toolLocation = ToolsConfig.getTknLocation();
      if (toolLocation) {
        // eslint-disable-next-line require-atomic-updates
        command.cliCommand = command.cliCommand.replace('tkn', `"${toolLocation}"`).replace(new RegExp('&& tkn', 'g'), `&& "${toolLocation}"`);
      }
    }

    return cli.execute(command, cwd ? { cwd } : {})
      .then(async (result) => result.error && fail ? Promise.reject(result.error) : result)
      .catch((err) => fail ? Promise.reject(err) : Promise.resolve({ error: null, stdout: '', stderr: '' }));
  }

}

export const tkn = new TknImpl();
