export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = props;
  }

  public equals(other: ValueObject<T>): boolean {
    if (!other || !other.props) {
      return false;
    }

    return this.shallowEquals(other);
  }

  protected shallowEquals(other: ValueObject<T>): boolean {
    const keys = Object.keys(this.props) as Array<keyof T>;

    for (const key of keys) {
      if (this.props[key] !== other.props[key]) {
        return false;
      }
    }

    return true;
  }
}
