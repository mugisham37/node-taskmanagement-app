import { useCallback, useState } from 'react'

// Loading state interface
interface LoadingState {
  isLoading: boolean
  error: Error | null
  data: any
}

// Loading state hook
export function useLoadingState<T = any>(initialData?: T) {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    data: initialData || null,
  })

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }))
  }, [])

  const setError = useCallback((error: Error | null) => {
    setState(prev => ({ ...prev, error, isLoading: false }))
  }, [])

  const setData = useCallback((data: T) => {
    setState(prev => ({ ...prev, data, error: null, isLoading: false }))
  }, [])

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      data: initialData || null,
    })
  }, [initialData])

  const execute = useCallback(async <R = T>(
    asyncFunction: () => Promise<R>
  ): Promise<R | null> => {
    try {
      setLoading(true)
      const result = await asyncFunction()
      setData(result as any)
      return result
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }, [setLoading, setData, setError])

  return {
    ...state,
    setLoading,
    setError,
    setData,
    reset,
    execute,
  }
}

// Multiple loading states hook
export function useMultipleLoadingStates() {
  const [states, setStates] = useState<Record<string, LoadingState>>({})

  const getState = useCallback((key: string): LoadingState => {
    return states[key] || { isLoading: false, error: null, data: null }
  }, [states])

  const setLoading = useCallback((key: string, loading: boolean) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], isLoading: loading },
    }))
  }, [])

  const setError = useCallback((key: string, error: Error | null) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], error, isLoading: false },
    }))
  }, [])

  const setData = useCallback((key: string, data: any) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], data, error: null, isLoading: false },
    }))
  }, [])

  const reset = useCallback((key?: string) => {
    if (key) {
      setStates(prev => ({
        ...prev,
        [key]: { isLoading: false, error: null, data: null },
      }))
    } else {
      setStates({})
    }
  }, [])

  const execute = useCallback(async <T = any>(
    key: string,
    asyncFunction: () => Promise<T>
  ): Promise<T | null> => {
    try {
      setLoading(key, true)
      const result = await asyncFunction()
      setData(key, result)
      return result
    } catch (error) {
      setError(key, error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }, [setLoading, setData, setError])

  return {
    states,
    getState,
    setLoading,
    setError,
    setData,
    reset,
    execute,
  }
}

// Global loading state for app-wide loading indicators
class GlobalLoadingState {
  private listeners: Set<(isLoading: boolean) => void> = new Set()
  private loadingOperations: Set<string> = new Set()

  subscribe(listener: (isLoading: boolean) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    const isLoading = this.loadingOperations.size > 0
    this.listeners.forEach(listener => listener(isLoading))
  }

  start(operationId: string) {
    this.loadingOperations.add(operationId)
    this.notify()
  }

  stop(operationId: string) {
    this.loadingOperations.delete(operationId)
    this.notify()
  }

  get isLoading() {
    return this.loadingOperations.size > 0
  }
}

export const globalLoadingState = new GlobalLoadingState()

// Hook to use global loading state
export function useGlobalLoadingState() {
  const [isLoading, setIsLoading] = useState(globalLoadingState.isLoading)

  useState(() => {
    return globalLoadingState.subscribe(setIsLoading)
  })

  const startLoading = useCallback((operationId: string) => {
    globalLoadingState.start(operationId)
  }, [])

  const stopLoading = useCallback((operationId: string) => {
    globalLoadingState.stop(operationId)
  }, [])

  return {
    isLoading,
    startLoading,
    stopLoading,
  }
}