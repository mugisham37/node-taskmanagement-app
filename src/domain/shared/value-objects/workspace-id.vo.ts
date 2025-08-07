import { ValueObject } from './value-object';
import { v4 as uuidv4 } from 'uuid';

export interface WorkspaceIdProps {
  value: string;
}

export class WorkspaceId extends ValueObject<WorkspaceIdProps> {
  private constructor(props: WorkspaceIdProps) {
    super(props);
  }

  public static create(id?: string): WorkspaceId {
    const value = id || uuidv4();

    if (!this.isValidUuid(value)) {
      throw new Error('Invalid workspace ID format');
    }

    return new WorkspaceId({ value });
  }

  public get value(): string {
    return this.props.value;
  }

  public equals(other: WorkspaceId): boolean {
    return this.props.value === other.props.value;
  }

  private static isValidUuid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
