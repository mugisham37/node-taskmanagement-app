/**
 * Base DTO interface for all data transfer objects
 */
export interface BaseDto {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Base request DTO
 */
export interface BaseRequestDto {
  // Common request properties can be added here
}

/**
 * Base response DTO
 */
export interface BaseResponseDto {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}
