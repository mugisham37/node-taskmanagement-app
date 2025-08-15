// Service Worker for background sync and offline support

const CACHE_NAME = 'taskmanagement-v1';
const OFFLINE_URL = '/offline';

// Files to cache for offline functionality
const CACHE_FILES = [
  '/',
  '/offline',
  '/dashboard',
  '/manifest.json',
  // Add other critical files
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If request is successful, clone and cache the response
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // If fetch fails, try to serve from cache
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If no cached response and it's a navigation request, serve offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
            // For other requests, return a generic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: {
                'Content-Type': 'text/plain',
              },
            });
          });
      })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

// Process offline queue during background sync
async function processOfflineQueue() {
  try {
    // Get offline queue from IndexedDB or localStorage
    const queue = await getOfflineQueue();
    
    if (queue.length === 0) {
      return;
    }

    // Process each queued operation
    for (const operation of queue) {
      try {
        await processOperation(operation);
        await removeFromQueue(operation.id);
      } catch (error) {
        console.error('Failed to process queued operation:', error);
        
        // Increment retry count
        operation.retryCount = (operation.retryCount || 0) + 1;
        
        // Remove if max retries reached
        if (operation.retryCount >= 3) {
          await removeFromQueue(operation.id);
        } else {
          await updateQueueItem(operation);
        }
      }
    }

    // Notify clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        processedCount: queue.length,
      });
    });

  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Process individual operation
async function processOperation(operation) {
  const { type, method, url, data } = operation;
  
  const response = await fetch(url, {
    method: method || 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Get offline queue from storage
async function getOfflineQueue() {
  try {
    // Try IndexedDB first, fallback to localStorage
    if ('indexedDB' in self) {
      return await getQueueFromIndexedDB();
    } else {
      return getQueueFromLocalStorage();
    }
  } catch (error) {
    console.error('Failed to get offline queue:', error);
    return [];
  }
}

// IndexedDB operations
async function getQueueFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineQueue', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['queue'], 'readonly');
      const store = transaction.objectStore('queue');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };
  });
}

// Remove item from queue
async function removeFromQueue(id) {
  if ('indexedDB' in self) {
    return removeFromIndexedDB(id);
  } else {
    return removeFromLocalStorage(id);
  }
}

async function removeFromIndexedDB(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineQueue', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Update queue item
async function updateQueueItem(operation) {
  if ('indexedDB' in self) {
    return updateInIndexedDB(operation);
  } else {
    return updateInLocalStorage(operation);
  }
}

async function updateInIndexedDB(operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineQueue', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const putRequest = store.put(operation);
      
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
  });
}

// LocalStorage fallback operations
function getQueueFromLocalStorage() {
  try {
    const stored = localStorage.getItem('offline_queue');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get queue from localStorage:', error);
    return [];
  }
}

function removeFromLocalStorage(id) {
  try {
    const queue = getQueueFromLocalStorage();
    const filtered = queue.filter(item => item.id !== id);
    localStorage.setItem('offline_queue', JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
}

function updateInLocalStorage(operation) {
  try {
    const queue = getQueueFromLocalStorage();
    const index = queue.findIndex(item => item.id === operation.id);
    
    if (index !== -1) {
      queue[index] = operation;
      localStorage.setItem('offline_queue', JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Failed to update localStorage:', error);
  }
}

// Handle push notifications (if needed)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data.data,
      actions: data.actions,
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action) {
    // Handle action button clicks
    handleNotificationAction(event.action, event.notification.data);
  } else {
    // Handle notification click
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  }
});

function handleNotificationAction(action, data) {
  switch (action) {
    case 'view':
      clients.openWindow(data?.url || '/');
      break;
    case 'dismiss':
      // Just close the notification
      break;
    default:
      console.log('Unknown notification action:', action);
  }
}