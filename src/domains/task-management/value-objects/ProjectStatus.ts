import { ValueObject } from '../../../shared/domain/value-objects/ValueObject';

export enum ProjectStatusEnum {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface ProjectStatusProps {
  value: ProjectStatusEnum;
}

export class ProjectStatus extends ValueObject<ProjectStatusProps> {
  private constructor(props: ProjectStatusProps) {
    super(props);
  }

  public static create(value: ProjectStatusEnum): ProjectStatus {
    return new ProjectStatus({ value });
  }

  public static fromString(value: string): ProjectStatus {
    const upperValue = value.toUpperCase();
    if (
      !Object.values(ProjectStatusEnum).includes(
        upperValue as ProjectStatusEnum
      )
    ) {
      throw new Error(`Invalid project status: ${value}`);
    }
    return new ProjectStatus({ value: upperValue as ProjectStatusEnum });
  }

  public static planning(): ProjectStatus {
    return new ProjectStatus({ value: ProjectStatusEnum.PLANNING });
  }

  public static active(): ProjectStatus {
    return new ProjectStatus({ value: ProjectStatusEnum.ACTIVE });
  }

  public static onHold(): ProjectStatus {
    return new ProjectStatus({ value: ProjectStatusEnum.ON_HOLD });
  }

  public static completed(): ProjectStatus {
    return new ProjectStatus({ value: ProjectStatusEnum.COMPLETED });
  }

  public static cancelled(): ProjectStatus {
    return new ProjectStatus({ value: ProjectStatusEnum.CANCELLED });
  }

  get value(): ProjectStatusEnum {
    return this.props.value;
  }

  public equals(other: ProjectStatus): boolean {
    return this.props.value === other.props.value;
  }

  public toString(): string {
    return this.props.value;
  }

  public isCompleted(): boolean {
    return this.props.value === ProjectStatusEnum.COMPLETED;
  }

  public isCancelled(): boolean {
    return this.props.value === ProjectStatusEnum.CANCELLED;
  }

  public isActive(): boolean {
    return this.props.value === ProjectStatusEnum.ACTIVE;
  }

  public canAcceptTasks(): boolean {
    return (
      this.props.value === ProjectStatusEnum.PLANNING ||
      this.props.value === ProjectStatusEnum.ACTIVE
    );
  }

  public canTransitionTo(newStatus: ProjectStatus): boolean {
    const transitions: Record<ProjectStatusEnum, ProjectStatusEnum[]> = {
      [ProjectStatusEnum.PLANNING]: [
        ProjectStatusEnum.ACTIVE,
        ProjectStatusEnum.CANCELLED,
      ],
      [ProjectStatusEnum.ACTIVE]: [
        ProjectStatusEnum.ON_HOLD,
        ProjectStatusEnum.COMPLETED,
        ProjectStatusEnum.CANCELLED,
      ],
      [ProjectStatusEnum.ON_HOLD]: [
        ProjectStatusEnum.ACTIVE,
        ProjectStatusEnum.CANCELLED,
      ],
      [ProjectStatusEnum.COMPLETED]: [ProjectStatusEnum.ACTIVE], // Allow reopening
      [ProjectStatusEnum.CANCELLED]: [ProjectStatusEnum.PLANNING], // Allow reactivation
    };

    return transitions[this.props.value].includes(newStatus.value);
  }
}
