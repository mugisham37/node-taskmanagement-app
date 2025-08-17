import { handlers } from '@/mocks/handlers'
import { setupWorker } from 'msw/browser'
import { setupServer } from 'msw/node'

// Setup MSW for browser environment
export const worker = typeof window !== 'undefined' 
  ? setupWorker(...handlers)
  : undefined

// Setup MSW for Node.js environment (testing)
export const server = setupServer(...handlers)

// Start MSW in development
export const startMSW = async () => {
  if (typeof window !== 'undefined' && worker) {
    // Browser environment
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    })
    console.log('MSW started in browser')
  }
}

// Stop MSW
export const stopMSW = () => {
  if (typeof window !== 'undefined' && worker) {
    worker.stop()
    console.log('MSW stopped in browser')
  }
}

// Enable/disable MSW based on environment
export const enableMSW = process.env.NODE_ENV === 'development' && 
  process.env.NEXT_PUBLIC_ENABLE_MSW === 'true'