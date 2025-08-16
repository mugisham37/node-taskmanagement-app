import { Webhook } from '@taskmanagement/domain';
import { DatabaseConnection } from '../connection';

export class WebhookSeeder {
  constructor(_connection: DatabaseConnection) {
    // Connection not used in simple implementation
  }

  async seed(userIds: string[], workspaceIds: string[], count: number = 20): Promise<Webhook[]> {
    const webhooks: Webhook[] = [];

    console.log(`Webhook seeding is not yet implemented - would create ${count} webhooks`);
    console.log(`Available users: ${userIds.length}, workspaces: ${workspaceIds.length}`);

    // TODO: Implement proper webhook seeding when Webhook entity has proper creation methods
    // For now, just return empty array to prevent errors

    return webhooks;
  }

  async getExistingWebhooks(): Promise<Webhook[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
