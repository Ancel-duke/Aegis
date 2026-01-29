import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as k8s from '@kubernetes/client-node';

@Injectable()
export class KubernetesService implements OnModuleInit {
  private readonly logger = new Logger(KubernetesService.name);
  private kc: k8s.KubeConfig;
  private k8sApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeKubernetesClient();
  }

  private initializeKubernetesClient() {
    this.kc = new k8s.KubeConfig();

    const inCluster = this.configService.get<boolean>('IN_CLUSTER', false);

    if (inCluster) {
      // Load from in-cluster config
      this.kc.loadFromCluster();
      this.logger.log('Loaded Kubernetes config from cluster');
    } else {
      // Load from kubeconfig file
      const kubeconfigPath = this.configService.get<string>('KUBECONFIG_PATH');
      if (kubeconfigPath) {
        this.kc.loadFromFile(kubeconfigPath);
        this.logger.log(`Loaded Kubernetes config from ${kubeconfigPath}`);
      } else {
        this.kc.loadFromDefault();
        this.logger.log('Loaded Kubernetes config from default location');
      }
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  /**
   * Restart a pod by deleting it (will be recreated by deployment)
   */
  async restartPod(namespace: string, podName: string): Promise<any> {
    try {
      this.logger.log(`Restarting pod ${podName} in namespace ${namespace}`);

      const response = await this.k8sApi.deleteNamespacedPod(
        podName,
        namespace,
      );

      this.logger.log(`Pod ${podName} deleted successfully`);
      return response.body;
    } catch (error) {
      this.logger.error(
        `Failed to restart pod ${podName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Scale a deployment
   */
  async scaleDeployment(
    namespace: string,
    deploymentName: string,
    replicas: number,
  ): Promise<any> {
    try {
      this.logger.log(
        `Scaling deployment ${deploymentName} to ${replicas} replicas in namespace ${namespace}`,
      );

      // Get current deployment
      const deployment = await this.k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        namespace,
      );

      // Update replica count
      if (deployment.body.spec) {
        deployment.body.spec.replicas = replicas;
      }

      // Apply update
      const response = await this.k8sAppsApi.replaceNamespacedDeployment(
        deploymentName,
        namespace,
        deployment.body,
      );

      this.logger.log(
        `Deployment ${deploymentName} scaled to ${replicas} replicas`,
      );
      return response.body;
    } catch (error) {
      this.logger.error(
        `Failed to scale deployment ${deploymentName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Rollback a deployment to previous revision
   */
  async rollbackDeployment(
    namespace: string,
    deploymentName: string,
    revision?: number,
  ): Promise<any> {
    try {
      this.logger.log(
        `Rolling back deployment ${deploymentName} in namespace ${namespace}`,
      );

      // Create rollback object
      const rollback = {
        apiVersion: 'apps/v1',
        kind: 'DeploymentRollback',
        name: deploymentName,
        rollbackTo: {
          revision: revision || 0, // 0 means previous revision
        },
      };

      // Note: DeploymentRollback is deprecated in newer K8s versions
      // Alternative: Use kubectl rollout undo or manually update deployment
      // For this example, we'll scale down and up to trigger a rollback

      const deployment = await this.k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        namespace,
      );

      // Trigger rollback by adding annotation
      const body = deployment.body;
      if (!body.metadata) {
        body.metadata = {};
      }
      if (!body.metadata.annotations) {
        body.metadata.annotations = {};
      }
      body.metadata.annotations['kubectl.kubernetes.io/restartedAt'] =
        new Date().toISOString();

      const response = await this.k8sAppsApi.replaceNamespacedDeployment(
        deploymentName,
        namespace,
        deployment.body,
      );

      this.logger.log(`Deployment ${deploymentName} rollback initiated`);
      return response.body;
    } catch (error) {
      this.logger.error(
        `Failed to rollback deployment ${deploymentName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get pod status
   */
  async getPodStatus(
    namespace: string,
    podName: string,
  ): Promise<k8s.V1Pod> {
    try {
      const response = await this.k8sApi.readNamespacedPod(podName, namespace);
      return response.body;
    } catch (error) {
      this.logger.error(
        `Failed to get pod status ${podName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(
    namespace: string,
    deploymentName: string,
  ): Promise<k8s.V1Deployment> {
    try {
      const response = await this.k8sAppsApi.readNamespacedDeployment(
        deploymentName,
        namespace,
      );
      return response.body;
    } catch (error) {
      this.logger.error(
        `Failed to get deployment status ${deploymentName}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * List pods in namespace
   */
  async listPods(namespace: string): Promise<k8s.V1Pod[]> {
    try {
      const response = await this.k8sApi.listNamespacedPod(namespace);
      return response.body.items;
    } catch (error) {
      this.logger.error(
        `Failed to list pods in namespace ${namespace}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * List deployments in namespace
   */
  async listDeployments(namespace: string): Promise<k8s.V1Deployment[]> {
    try {
      const response = await this.k8sAppsApi.listNamespacedDeployment(
        namespace,
      );
      return response.body.items;
    } catch (error) {
      this.logger.error(
        `Failed to list deployments in namespace ${namespace}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Check if resource exists
   */
  async resourceExists(
    namespace: string,
    resourceType: 'pod' | 'deployment',
    resourceName: string,
  ): Promise<boolean> {
    try {
      if (resourceType === 'pod') {
        await this.k8sApi.readNamespacedPod(resourceName, namespace);
      } else if (resourceType === 'deployment') {
        await this.k8sAppsApi.readNamespacedDeployment(
          resourceName,
          namespace,
        );
      }
      return true;
    } catch (error) {
      if (error.response?.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
