/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { basicTests } from './basic-test';
import * as login from './suite/login';
import * as pipelineRunTest from './suite/pipelinerun-test';

describe('VSCode Tekton UI tests', () => {
  const clusterUrl = 'https://api.openshift4.cluster.adapters-crs-qe.com:6443';
  //const clusterUrl = process.env.OPENSHIFT_CLUSTER_URL;

  //basicTests();
  //login.loginTest(clusterUrl);
  pipelineRunTest.pipelineRunTest(clusterUrl);
});
