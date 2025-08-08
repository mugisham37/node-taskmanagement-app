import { ValueObject } from '../../shared/value-objects/value-object';

export interface RefreshTokenProps {
  value: string;
}

export class RefreshToken extends ValueObject<RefreshTokenProps> {
  private constructor(props: RefreshTokenProps) {
    super(props);
  }

  public static create(token: string): RefreshToken {
    if (!token || token.trim().length === 0) {
      throw new Error('Refresh token cannot be empty');
    }

    if (token.length > 2000) {
      throw new Error('Refresh token is too long');
    }

    return new RefreshToken({ value: token.trim() });
  }

  public get value(): string {
    return this.props.value;
  }

  public getMaskedValue(): string {
    if (this.props.value.length <= 8) {
      return '*'.repeat(this.props.value.length);
    }

    const start = this.props.value.substring(0, 4);
    const end = this.props.value.substring(this.props.value.length - 4);
    const middle = '*'.repeat(this.props.value.length - 8);

    return `${start}${middle}${end}`;
  }
}
