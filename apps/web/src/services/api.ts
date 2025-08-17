import { appConfig } from '@/config/app'

// Base API configuration
const API_BASE_URL = appConfig.apiUrl
const API_TIMEOUT = appConfig.api.timeout

// Request interceptor type
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>

// Response interceptor type
type ResponseInterceptor = (response: Response) => Response | Promise<Response>

// Error interceptor type
type ErrorInterceptor = (error: ApiError) => Promise<never>

// Request configuration interface
interface RequestConfig extends RequestInit {
  url?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  skipAuth?: boolean
  skipErrorHandling?: boolean
  body?: BodyInit | null
}

// API Error class
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any,
    public code?: string
  ) {
    super(`API Error ${status}: ${statusText}`)
    this.name = 'ApiError'
  }
}

// Network Error class
export class NetworkError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'NetworkError'
  }
}

// Timeout Error class
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`)
    this.name = 'TimeoutError'
  }
}

// API Client class
class ApiClient {
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private errorInterceptors: ErrorInterceptor[] = []

  constructor(private baseURL: string = API_BASE_URL) {}

  // Add request interceptor
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor)
  }

  // Add response interceptor
  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor)
  }

  // Add error interceptor
  addErrorInterceptor(interceptor: ErrorInterceptor) {
    this.errorInterceptors.push(interceptor)
  }

  // Get authentication token
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(appConfig.auth.tokenKey)
  }

  // Create request with timeout
  private createRequestWithTimeout(
    url: string,
    config: RequestConfig,
    timeout: number
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        reject(new TimeoutError(timeout))
      }, timeout)

      fetch(url, {
        ...config,
        signal: controller.signal,
      })
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId))
    })
  }

  // Apply request interceptors
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = { ...config }
    
    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig)
    }
    
    return processedConfig
  }

  // Apply response interceptors
  private async applyResponseInterceptors(response: Response): Promise<Response> {
    let processedResponse = response
    
    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse)
    }
    
    return processedResponse
  }

  // Apply error interceptors
  private async applyErrorInterceptors(error: ApiError): Promise<never> {
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error)
    }
    throw error
  }

  // Make HTTP request with retries
  private async makeRequest(
    url: string,
    config: RequestConfig,
    attempt: number = 1
  ): Promise<Response> {
    try {
      const timeout = config.timeout || API_TIMEOUT
      const response = await this.createRequestWithTimeout(url, config, timeout)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const apiError = new ApiError(
          response.status,
          response.statusText,
          errorData,
          errorData.code
        )
        
        if (!config.skipErrorHandling) {
          await this.applyErrorInterceptors(apiError)
        }
        
        throw apiError
      }
      
      return await this.applyResponseInterceptors(response)
    } catch (error) {
      const maxRetries = config.retries ?? appConfig.api.retries
      const retryDelay = config.retryDelay ?? appConfig.api.retryDelay
      
      // Don't retry on client errors (4xx) or if max retries reached
      if (
        error instanceof ApiError && 
        (error.status >= 400 && error.status < 500) ||
        attempt >= maxRetries
      ) {
        throw error
      }
      
      // Don't retry timeout errors beyond max attempts
      if (error instanceof TimeoutError && attempt >= maxRetries) {
        throw error
      }
      
      // Wait before retry with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return this.makeRequest(url, config, attempt + 1)
    }
  }

  // Generic request method
  async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    // Apply default headers
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
    }
    
    // Add authentication header if not skipped
    if (!config.skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        defaultHeaders.Authorization = `Bearer ${token}`
      }
    }
    
    // Merge headers
    const headers = {
      ...defaultHeaders,
      ...config.headers,
    }
    
    // Apply request interceptors
    const processedConfig = await this.applyRequestInterceptors({
      ...config,
      headers,
    })
    
    try {
      const response = await this.makeRequest(url, processedConfig)
      
      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        return null as T
      }
      
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Request was aborted', error)
      }
      
      if (error instanceof TypeError) {
        throw new NetworkError('Network error occurred', error)
      }
      
      throw error
    }
  }

  // HTTP method shortcuts
  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' })
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
    })
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
    })
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : null,
    })
  }

  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' })
  }

  // Upload file method
  async upload<T = any>(
    endpoint: string,
    file: File,
    config?: RequestConfig
  ): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)
    
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it
        ...config?.headers,
      },
    })
  }

  // Download file method
  async download(endpoint: string, filename?: string, config?: RequestConfig): Promise<void> {
    const response = await this.makeRequest(`${this.baseURL}${endpoint}`, {
      ...config,
      method: 'GET',
    })
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    window.URL.revokeObjectURL(url)
  }
}

// Create API client instance
export const apiClient = new ApiClient()

// Add default request interceptor for authentication
apiClient.addRequestInterceptor((config) => {
  // Add request ID for tracing
  const requestId = Math.random().toString(36).substring(7)
  return {
    ...config,
    headers: {
      ...config.headers,
      'X-Request-ID': requestId,
    },
  }
})

// Add default response interceptor for logging
apiClient.addResponseInterceptor((response) => {
  if (appConfig.isDevelopment) {
    console.log(`API Response: ${response.status} ${response.url}`)
  }
  return response
})

// Add default error interceptor for authentication errors
apiClient.addErrorInterceptor(async (error) => {
  if (error.status === 401) {
    // Clear authentication data
    if (typeof window !== 'undefined') {
      localStorage.removeItem(appConfig.auth.tokenKey)
      localStorage.removeItem(appConfig.auth.refreshTokenKey)
      
      // Redirect to login page
      window.location.href = '/login'
    }
  }
  
  // Log errors in development
  if (appConfig.isDevelopment) {
    console.error('API Error:', error)
  }
  
  // Re-throw the error to maintain the Promise<never> return type
  throw error
})

// Export types and classes
export { ApiClient, apiClient, ApiError, NetworkError, TimeoutError }
export type { RequestConfig }

