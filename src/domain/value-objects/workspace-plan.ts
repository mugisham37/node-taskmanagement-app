/**
 * Workspace Plan Value Object
 * Represents the different plans available for workspaces
 */
export class WorkspacePlan {
  public static readonly FREE = 'FREE';
  public static readonly STARTER = 'STARTER';
  public static readonly PROFESSIONAL = 'PROFESSIONAL';
  public static readonly ENTERPRISE = 'ENTERPRISE';

  private static readonly VALID_PLANS = [
    WorkspacePlan.FREE,
    WorkspacePlan.STARTER,
    WorkspacePlan.PROFESSIONAL,
    WorkspacePlan.ENTERPRISE
  ];

  private constructor(private readonly value: string) {}

  public static fromString(value: string): WorkspacePlan {
    if (!WorkspacePlan.VALID_PLANS.includes(value)) {
      throw new Error(`Invalid workspace plan: ${value}`);
    }
    return new WorkspacePlan(value);
  }

  public static free(): WorkspacePlan {
    return new WorkspacePlan(WorkspacePlan.FREE);
  }

  public static starter(): WorkspacePlan {
    return new WorkspacePlan(WorkspacePlan.STARTER);
  }

  public static professional(): WorkspacePlan {
    return new WorkspacePlan(WorkspacePlan.PROFESSIONAL);
  }

  public static enterprise(): WorkspacePlan {
    return new WorkspacePlan(WorkspacePlan.ENTERPRISE);
  }

  public getValue(): string {
    return this.value;
  }

  public toString(): string {
    return this.value;
  }

  public equals(other: WorkspacePlan): boolean {
    return this.value === other.value;
  }

  public isFree(): boolean {
    return this.value === WorkspacePlan.FREE;
  }

  public isStarter(): boolean {
    return this.value === WorkspacePlan.STARTER;
  }

  public isProfessional(): boolean {
    return this.value === WorkspacePlan.PROFESSIONAL;
  }

  public isEnterprise(): boolean {
    return this.value === WorkspacePlan.ENTERPRISE;
  }

  public isPaid(): boolean {
    return !this.isFree();
  }

  public getMaxProjects(): number {
    switch (this.value) {
      case WorkspacePlan.FREE:
        return 3;
      case WorkspacePlan.STARTER:
        return 10;
      case WorkspacePlan.PROFESSIONAL:
        return 50;
      case WorkspacePlan.ENTERPRISE:
        return -1; // Unlimited
      default:
        return 0;
    }
  }

  public getMaxMembers(): number {
    switch (this.value) {
      case WorkspacePlan.FREE:
        return 5;
      case WorkspacePlan.STARTER:
        return 25;
      case WorkspacePlan.PROFESSIONAL:
        return 100;
      case WorkspacePlan.ENTERPRISE:
        return -1; // Unlimited
      default:
        return 0;
    }
  }

  public getStorageLimit(): number {
    switch (this.value) {
      case WorkspacePlan.FREE:
        return 1024; // 1GB in MB
      case WorkspacePlan.STARTER:
        return 10240; // 10GB in MB
      case WorkspacePlan.PROFESSIONAL:
        return 102400; // 100GB in MB
      case WorkspacePlan.ENTERPRISE:
        return -1; // Unlimited
      default:
        return 0;
    }
  }

  public hasAdvancedFeatures(): boolean {
    return this.isProfessional() || this.isEnterprise();
  }

  public hasCustomIntegrations(): boolean {
    return this.isEnterprise();
  }

  public hasPrioritySupport(): boolean {
    return this.isProfessional() || this.isEnterprise();
  }

  public getFeatures(): string[] {
    const baseFeatures = ['Basic project management', 'Task tracking', 'Team collaboration'];
    
    switch (this.value) {
      case WorkspacePlan.FREE:
        return baseFeatures;
      case WorkspacePlan.STARTER:
        return [...baseFeatures, 'Time tracking', 'Basic reporting'];
      case WorkspacePlan.PROFESSIONAL:
        return [
          ...baseFeatures,
          'Time tracking',
          'Advanced reporting',
          'Custom fields',
          'Gantt charts',
          'Priority support'
        ];
      case WorkspacePlan.ENTERPRISE:
        return [
          ...baseFeatures,
          'Time tracking',
          'Advanced reporting',
          'Custom fields',
          'Gantt charts',
          'Priority support',
          'Custom integrations',
          'SSO',
          'Advanced security',
          'Dedicated support'
        ];
      default:
        return [];
    }
  }
}
