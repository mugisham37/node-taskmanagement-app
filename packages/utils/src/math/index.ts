/**
 * Math utility functions
 */

export class MathUtils {
  /**
   * Clamp a number between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Generate random number between min and max (inclusive)
   */
  static randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random float between min and max
   */
  static randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Round number to specified decimal places
   */
  static round(value: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Check if number is even
   */
  static isEven(value: number): boolean {
    return value % 2 === 0;
  }

  /**
   * Check if number is odd
   */
  static isOdd(value: number): boolean {
    return value % 2 !== 0;
  }

  /**
   * Calculate percentage
   */
  static percentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  /**
   * Calculate percentage change
   */
  static percentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue === 0 ? 0 : 100;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Convert degrees to radians
   */
  static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate distance between two points
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Calculate factorial
   */
  static factorial(n: number): number {
    if (n < 0) throw new Error('Factorial is not defined for negative numbers');
    if (n === 0 || n === 1) return 1;
    return n * MathUtils.factorial(n - 1);
  }

  /**
   * Check if number is prime
   */
  static isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  /**
   * Calculate greatest common divisor
   */
  static gcd(a: number, b: number): number {
    return b === 0 ? a : MathUtils.gcd(b, a % b);
  }

  /**
   * Calculate least common multiple
   */
  static lcm(a: number, b: number): number {
    return Math.abs(a * b) / MathUtils.gcd(a, b);
  }

  /**
   * Calculate fibonacci number at position n
   */
  static fibonacci(n: number): number {
    if (n < 0) throw new Error('Fibonacci is not defined for negative numbers');
    if (n <= 1) return n;
    
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  /**
   * Calculate power with modulo
   */
  static modPow(base: number, exponent: number, modulus: number): number {
    if (modulus === 1) return 0;
    
    let result = 1;
    base = base % modulus;
    
    while (exponent > 0) {
      if (exponent % 2 === 1) {
        result = (result * base) % modulus;
      }
      exponent = Math.floor(exponent / 2);
      base = (base * base) % modulus;
    }
    
    return result;
  }

  /**
   * Linear interpolation between two values
   */
  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Map value from one range to another
   */
  static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  }

  /**
   * Calculate average of numbers
   */
  static average(...numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  /**
   * Calculate median of numbers
   */
  static median(...numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calculate mode of numbers
   */
  static mode(...numbers: number[]): number[] {
    if (numbers.length === 0) return [];
    
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    
    for (const num of numbers) {
      frequency[num] = (frequency[num] || 0) + 1;
      maxFreq = Math.max(maxFreq, frequency[num]);
    }
    
    return Object.keys(frequency)
      .filter(key => frequency[Number(key)] === maxFreq)
      .map(Number);
  }

  /**
   * Calculate standard deviation
   */
  static standardDeviation(...numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const avg = MathUtils.average(...numbers);
    const squaredDiffs = numbers.map(num => Math.pow(num - avg, 2));
    const avgSquaredDiff = MathUtils.average(...squaredDiffs);
    
    return Math.sqrt(avgSquaredDiff);
  }
}