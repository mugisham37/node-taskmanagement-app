import { ValueObject } from '../../shared/value-objects/value-object';

export interface AccessTokenProps {
  value: string;
}

export class AccessToken extends ValueObject<AccessTokenProps> {
  private constructor(props: AccessTokenProps) {
    super(props);
  }

  public static create(token: string): AccessToken {
    if (!token || token.trim().length === 0) {
      throw new Error('Access token cannot be empty');
    }

    if (token.length > 2000) {
      throw new Error('Access token is too long');
    }

    return new AccessToken({ value: token.trim() });
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
