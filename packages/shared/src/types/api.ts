// API-related types for client-server communication

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  field?: string;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterParams {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  tags?: string[];
}

// WebSocket event types
export interface WebSocketEvent<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  userId?: string;
  roomId?: string;
}

export interface WebSocketMessage {
  id: string;
  type: 'event' | 'response' | 'error';
  data: any;
  timestamp: Date;
}