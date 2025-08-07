import { ValueObject } from './ValueObject';

export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private static readonly SUPPORTED_CURRENCIES = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CAD',
    'AUD',
    'CHF',
    'CNY',
    'INR',
    'BRL',
  ];

  private static readonly CURRENCY_DECIMALS: Record<string, number> = {
    USD: 2,
    EUR: 2,
    GBP: 2,
    CAD: 2,
    AUD: 2,
    CHF: 2,
    BRL: 2,
    INR: 2,
    JPY: 0,
    CNY: 2,
  };

  private constructor(props: MoneyProps) {
    super(props);
  }

  public static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }

    if (!Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number');
    }

    const upperCurrency = currency.toUpperCase();
    if (!this.SUPPORTED_CURRENCIES.includes(upperCurrency)) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    // Round to appropriate decimal places for currency
    const decimals = this.CURRENCY_DECIMALS[upperCurrency] || 2;
    const roundedAmount =
      Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);

    return new Money({
      amount: roundedAmount,
      currency: upperCurrency,
    });
  }

  public static zero(currency: string): Money {
    return Money.create(0, currency);
  }

  public static fromString(value: string, currency: string): Money {
    const cleanValue = value.replace(/[^\d.-]/g, '');
    const amount = parseFloat(cleanValue);

    if (isNaN(amount)) {
      throw new Error(`Invalid money amount: ${value}`);
    }

    return Money.create(amount, currency);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  public equals(other: Money): boolean {
    return (
      this.props.amount === other.props.amount &&
      this.props.currency === other.props.currency
    );
  }

  public toString(): string {
    return `${this.props.amount} ${this.props.currency}`;
  }

  public add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(
      this.props.amount + other.props.amount,
      this.props.currency
    );
  }

  public subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    const result = this.props.amount - other.props.amount;
    if (result < 0) {
      throw new Error('Subtraction would result in negative amount');
    }
    return Money.create(result, this.props.currency);
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Cannot multiply money by negative factor');
    }
    return Money.create(this.props.amount * factor, this.props.currency);
  }

  public divide(divisor: number): Money {
    if (divisor <= 0) {
      throw new Error('Cannot divide money by zero or negative number');
    }
    return Money.create(this.props.amount / divisor, this.props.currency);
  }

  public isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount > other.props.amount;
  }

  public isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount < other.props.amount;
  }

  public isGreaterThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount >= other.props.amount;
  }

  public isLessThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount <= other.props.amount;
  }

  public isZero(): boolean {
    return this.props.amount === 0;
  }

  public isPositive(): boolean {
    return this.props.amount > 0;
  }

  public percentage(percent: number): Money {
    if (percent < 0 || percent > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return this.multiply(percent / 100);
  }

  public format(locale: string = 'en-US'): string {
    const decimals = Money.CURRENCY_DECIMALS[this.props.currency] || 2;

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.props.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(this.props.amount);
  }

  public toMinorUnits(): number {
    const decimals = Money.CURRENCY_DECIMALS[this.props.currency] || 2;
    return Math.round(this.props.amount * Math.pow(10, decimals));
  }

  public static fromMinorUnits(minorUnits: number, currency: string): Money {
    const decimals = Money.CURRENCY_DECIMALS[currency.toUpperCase()] || 2;
    const amount = minorUnits / Math.pow(10, decimals);
    return Money.create(amount, currency);
  }

  private ensureSameCurrency(other: Money): void {
    if (this.props.currency !== other.props.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.props.currency} and ${other.props.currency}`
      );
    }
  }

  public convertTo(targetCurrency: string, exchangeRate: number): Money {
    if (exchangeRate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    const convertedAmount = this.props.amount * exchangeRate;
    return Money.create(convertedAmount, targetCurrency);
  }

  public allocate(ratios: number[]): Money[] {
    if (ratios.length === 0) {
      throw new Error('At least one ratio must be provided');
    }

    if (ratios.some(ratio => ratio < 0)) {
      throw new Error('All ratios must be non-negative');
    }

    const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
    if (totalRatio === 0) {
      throw new Error('Total ratio cannot be zero');
    }

    const minorUnits = this.toMinorUnits();
    const allocatedUnits: number[] = [];
    let remainder = minorUnits;

    // Allocate based on ratios
    for (let i = 0; i < ratios.length - 1; i++) {
      const allocation = Math.floor((minorUnits * ratios[i]) / totalRatio);
      allocatedUnits.push(allocation);
      remainder -= allocation;
    }

    // Last allocation gets the remainder
    allocatedUnits.push(remainder);

    return allocatedUnits.map(units =>
      Money.fromMinorUnits(units, this.props.currency)
    );
  }
}
