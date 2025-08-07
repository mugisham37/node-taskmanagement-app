import { ValueObject } from './value-object';
import { v4 as uuidv4 } from 'uuid';

export interface TeamIdProps {
  value: string;
}

export class TeamId extends ValueObject<TeamIdProps> {
  private constructor(props: TeamIdProps) {
    super(props);
  }

  public static create(id?: string): TeamId {
    const value = id || uuidv4();

    if (!this.isValidUuid(value)) {
      throw new Error('Invalid team ID format');
    }

    return new TeamId({ value });
  }

  public get value(): string {
    return this.props.value;
  }

  public equals(other: TeamId): boolean {
    return this.props.value === other.props.value;
  }

  private static isValidUuid(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
