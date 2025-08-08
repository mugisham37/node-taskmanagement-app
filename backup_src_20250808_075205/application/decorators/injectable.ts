// Simple injectable decorator for dependency injection
export function Injectable() {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    // Mark the class as injectable
    Reflect.defineMetadata('injectable', true, constructor);
    return constructor;
  };
}

// Utility to check if a class is injectable
export function isInjectable(target: any): boolean {
  return Reflect.getMetadata('injectable', target) === true;
}
