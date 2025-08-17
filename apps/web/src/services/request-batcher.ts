import { apiClient } from './api'

// Batch request interface
interface BatchRequest {
  id: string
  endpoint: string
  method: string
  data?: any
  resolve: (value: any) => void
  reject: (error: any) => void
}

// Batch response interface
interface BatchResponse {
  id: string
  data?: any
  error?: any
  status: number
}

// Request batcher class
class RequestBatcher {
  private queue: BatchRequest[] = []
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly batchDelay: number = 50 // ms
  private readonly maxBatchSize: number = 10

  // Add request to batch
  addRequest<T>(
    endpoint: string,
    method: string = 'GET',
    data?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.generateRequestId()
      
      this.queue.push({
        id,
        endpoint,
        method: method.toUpperCase(),
        data,
        resolve,
        reject,
      })

      // Schedule batch processing
      this.scheduleBatch()
    })
  }

  // Generate unique request ID
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`
  }

  // Schedule batch processing
  private scheduleBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    // Process immediately if batch is full
    if (this.queue.length >= this.maxBatchSize) {
      this.processBatch()
      return
    }

    // Otherwise, wait for more requests
    this.batchTimeout = setTimeout(() => {
      this.processBatch()
    }, this.batchDelay)
  }

  // Process the current batch
  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return

    const batch = [...this.queue]
    this.queue = []
    this.batchTimeout = null

    try {
      // Group requests by method and endpoint for optimization
      const groupedRequests = this.groupRequests(batch)
      
      // Process each group
      const results = await Promise.allSettled(
        Object.entries(groupedRequests).map(([key, requests]) =>
          this.processRequestGroup(key, requests)
        )
      )

      // Handle results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((response: BatchResponse) => {
            const request = batch.find(r => r.id === response.id)
            if (request) {
              if (response.error) {
                request.reject(response.error)
              } else {
                request.resolve(response.data)
              }
            }
          })
        } else {
          // Handle group failure
          const groupKey = Object.keys(groupedRequests)[index]
          const requests = groupedRequests[groupKey]
          requests.forEach(request => {
            request.reject(result.reason)
          })
        }
      })
    } catch (error) {
      // Handle batch failure
      batch.forEach(request => {
        request.reject(error)
      })
    }
  }

  // Group requests by method and endpoint
  private groupRequests(requests: BatchRequest[]): Record<string, BatchRequest[]> {
    return requests.reduce((groups, request) => {
      const key = `${request.method}:${request.endpoint}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(request)
      return groups
    }, {} as Record<string, BatchRequest[]>)
  }

  // Process a group of similar requests
  private async processRequestGroup(
    groupKey: string,
    requests: BatchRequest[]
  ): Promise<BatchResponse[]> {
    const [method, endpoint] = groupKey.split(':')

    // For GET requests, we can potentially optimize with a single request
    if (method === 'GET' && requests.length > 1) {
      return this.processGetRequestGroup(endpoint, requests)
    }

    // For other methods, process individually
    return Promise.all(
      requests.map(request => this.processSingleRequest(request))
    )
  }

  // Process GET requests group (can be optimized for bulk fetching)
  private async processGetRequestGroup(
    endpoint: string,
    requests: BatchRequest[]
  ): Promise<BatchResponse[]> {
    // If the endpoint supports bulk fetching, use it
    if (this.supportsBulkFetching(endpoint)) {
      return this.processBulkGetRequest(endpoint, requests)
    }

    // Otherwise, process individually
    return Promise.all(
      requests.map(request => this.processSingleRequest(request))
    )
  }

  // Check if endpoint supports bulk fetching
  private supportsBulkFetching(endpoint: string): boolean {
    // Define endpoints that support bulk operations
    const bulkEndpoints = [
      '/tasks',
      '/projects',
      '/users',
      '/notifications',
    ]

    return bulkEndpoints.some(bulkEndpoint => 
      endpoint.startsWith(bulkEndpoint)
    )
  }

  // Process bulk GET request
  private async processBulkGetRequest(
    endpoint: string,
    requests: BatchRequest[]
  ): Promise<BatchResponse[]> {
    try {
      // Extract IDs from individual requests if they're detail requests
      const ids = requests
        .map(req => this.extractIdFromEndpoint(req.endpoint))
        .filter(Boolean)

      if (ids.length > 0) {
        // Make bulk request with IDs
        const bulkEndpoint = `${endpoint}?ids=${ids.join(',')}`
        const response = await apiClient.get(bulkEndpoint)
        
        // Map bulk response back to individual requests
        return requests.map(request => {
          const id = this.extractIdFromEndpoint(request.endpoint)
          const data = response.data?.find((item: any) => item.id === id)
          
          return {
            id: request.id,
            data,
            status: data ? 200 : 404,
            error: data ? undefined : new Error('Not found'),
          }
        })
      }

      // Fallback to individual requests
      return Promise.all(
        requests.map(request => this.processSingleRequest(request))
      )
    } catch (error) {
      // Return error for all requests in the group
      return requests.map(request => ({
        id: request.id,
        error,
        status: 500,
      }))
    }
  }

  // Extract ID from endpoint (e.g., /tasks/123 -> 123)
  private extractIdFromEndpoint(endpoint: string): string | null {
    const match = endpoint.match(/\/([^\/]+)$/)
    return match ? match[1] : null
  }

  // Process single request
  private async processSingleRequest(request: BatchRequest): Promise<BatchResponse> {
    try {
      let response: any

      switch (request.method) {
        case 'GET':
          response = await apiClient.get(request.endpoint)
          break
        case 'POST':
          response = await apiClient.post(request.endpoint, request.data)
          break
        case 'PUT':
          response = await apiClient.put(request.endpoint, request.data)
          break
        case 'PATCH':
          response = await apiClient.patch(request.endpoint, request.data)
          break
        case 'DELETE':
          response = await apiClient.delete(request.endpoint)
          break
        default:
          throw new Error(`Unsupported method: ${request.method}`)
      }

      return {
        id: request.id,
        data: response,
        status: 200,
      }
    } catch (error) {
      return {
        id: request.id,
        error,
        status: error instanceof Error && 'status' in error ? (error as any).status : 500,
      }
    }
  }
}

// Create singleton instance
export const requestBatcher = new RequestBatcher()

// Convenience functions
export const batchedGet = <T>(endpoint: string): Promise<T> =>
  requestBatcher.addRequest<T>(endpoint, 'GET')

export const batchedPost = <T>(endpoint: string, data?: any): Promise<T> =>
  requestBatcher.addRequest<T>(endpoint, 'POST', data)

export const batchedPut = <T>(endpoint: string, data?: any): Promise<T> =>
  requestBatcher.addRequest<T>(endpoint, 'PUT', data)

export const batchedPatch = <T>(endpoint: string, data?: any): Promise<T> =>
  requestBatcher.addRequest<T>(endpoint, 'PATCH', data)

export const batchedDelete = <T>(endpoint: string): Promise<T> =>
  requestBatcher.addRequest<T>(endpoint, 'DELETE')