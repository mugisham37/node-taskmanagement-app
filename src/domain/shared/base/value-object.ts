export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = props;
  }

  public abstract equals(other: ValueObject<T>): boolean;

  protected shallowEquals(other: ValueObject<T>): boolean {
    if (!other || !other.props) {
      return false;
    }

    const keys = Object.keys(this.props) as Array<keyof T>;

    for (const key of keys) {
      if (this.props[key] !== other.props[key]) {
        return false;
      }
    }

    return true;
  }

  protected deepEquals(other: ValueObject<T>): boolean {
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
