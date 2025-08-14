/**
 * OpenAPI documentation types and schemas
 * This module provides comprehensive typing for OpenAPI documentation components
 */

import { OpenAPIV3 } from 'openapi-types';

// Extended OpenAPI types with proper $ref support
export interface APIParameter extends OpenAPIV3.ParameterObject {
  $ref?: string;
}

export interface APIResponse extends OpenAPIV3.ResponseObject {
  $ref?: string;
}

export interface APIRequestBody extends OpenAPIV3.RequestBodyObject {
  $ref?: string;
}

export interface APISchema {
  $ref?: string;
  type?: string;
  properties?: Record<string, any>;
  items?: any;
  required?: string[];
  description?: string;
  example?: any;
  examples?: Record<string, any>;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | any;
  oneOf?: any[];
  anyOf?: any[];
  allOf?: any[];
  not?: any;
}

// Common parameter references
export const CommonParameters = {
  PageParam: {
    $ref: '#/components/parameters/PageParam'
  } as APIParameter,
  
  LimitParam: {
    $ref: '#/components/parameters/LimitParam'
  } as APIParameter,
  
  SortByParam: {
    $ref: '#/components/parameters/SortByParam'
  } as APIParameter,
  
  SortOrderParam: {
    $ref: '#/components/parameters/SortOrderParam'
  } as APIParameter
};

// Common response references
export const CommonResponses = {
  Created: {
    $ref: '#/components/responses/Created'
  } as APIResponse,
  
  BadRequest: {
    $ref: '#/components/responses/BadRequest'
  } as APIResponse,
  
  Unauthorized: {
    $ref: '#/components/responses/Unauthorized'
  } as APIResponse,
  
  Forbidden: {
    $ref: '#/components/responses/Forbidden'
  } as APIResponse,
  
  NotFound: {
    $ref: '#/components/responses/NotFound'
  } as APIResponse,
  
  ValidationError: {
    $ref: '#/components/responses/ValidationError'
  } as APIResponse,
  
  InternalServerError: {
    $ref: '#/components/responses/InternalServerError'
  } as APIResponse
};

// Enhanced endpoint interface with proper typing
export interface EnhancedAPIEndpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: (APIParameter | OpenAPIV3.ReferenceObject)[];
  requestBody?: APIRequestBody | OpenAPIV3.ReferenceObject;
  responses: Record<string, APIResponse | OpenAPIV3.ReferenceObject>;
  security?: OpenAPIV3.SecurityRequirementObject[];
  examples?: Record<string, OpenAPIV3.ExampleObject>;
}

// Postman collection types
export interface PostmanRequest {
  method: string;
  header: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  url: {
    raw: string;
    host: string[];
    path: string[];
  };
  description?: string;
  body?: {
    mode: string;
    raw: string;
    options?: {
      raw: {
        language: string;
      };
    };
  };
}

export interface PostmanItem {
  name: string;
  request: PostmanRequest;
  response: any[];
}

export interface PostmanCollection {
  info: {
    name: string;
    description: string;
    version: string;
    schema: string;
  };
  auth: {
    type: string;
    bearer: Array<{
      key: string;
      value: string;
      type: string;
    }>;
  };
  variable: Array<{
    key: string;
    value: string;
    type: string;
  }>;
  item: PostmanItem[];
}

// Operation type for Postman conversion
export interface PostmanOperation {
  summary?: string;
  description?: string;
  requestBody?: {
    content?: {
      'application/json'?: {
        example?: any;
      };
    };
  };
}

// Enhanced OpenAPI specification type
export interface EnhancedOpenAPISpec extends OpenAPIV3.Document {
  info: OpenAPIV3.InfoObject;
  servers: OpenAPIV3.ServerObject[];
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject>;
    responses?: Record<string, OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject>;
    parameters?: Record<string, OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject>;
    requestBodies?: Record<string, OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject>;
    securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject>;
  };
  security?: OpenAPIV3.SecurityRequirementObject[];
  tags?: OpenAPIV3.TagObject[];
}

// Type guards
export function isReferenceObject(obj: any): obj is OpenAPIV3.ReferenceObject {
  return obj && typeof obj === 'object' && '$ref' in obj;
}

export function isParameterObject(obj: any): obj is OpenAPIV3.ParameterObject {
  return obj && typeof obj === 'object' && 'name' in obj && 'in' in obj;
}

export function isResponseObject(obj: any): obj is OpenAPIV3.ResponseObject {
  return obj && typeof obj === 'object' && 'description' in obj;
}

export function isPostmanOperation(obj: any): obj is PostmanOperation {
  return obj && typeof obj === 'object' && (
    'summary' in obj || 'description' in obj || 'requestBody' in obj
  );
}

// Default OpenAPI components
export const DefaultOpenAPIComponents: OpenAPIV3.ComponentsObject = {
  parameters: {
    PageParam: {
      name: 'page',
      in: 'query',
      description: 'Page number for pagination',
      required: false,
      schema: {
        type: 'integer',
        minimum: 1,
        default: 1
      }
    },
    LimitParam: {
      name: 'limit',
      in: 'query',
      description: 'Number of items per page',
      required: false,
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20
      }
    },
    SortByParam: {
      name: 'sortBy',
      in: 'query',
      description: 'Field to sort by',
      required: false,
      schema: {
        type: 'string'
      }
    },
    SortOrderParam: {
      name: 'sortOrder',
      in: 'query',
      description: 'Sort order (asc or desc)',
      required: false,
      schema: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'asc'
      }
    }
  },
  responses: {
    Created: {
      description: 'Resource created successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    },
    BadRequest: {
      description: 'Bad request - invalid input',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string' },
              errors: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    Unauthorized: {
      description: 'Unauthorized - invalid credentials',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Unauthorized' }
            }
          }
        }
      }
    },
    Forbidden: {
      description: 'Forbidden - insufficient permissions',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Forbidden' }
            }
          }
        }
      }
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Not Found' }
            }
          }
        }
      }
    },
    ValidationError: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string' },
              errors: {
                type: 'object',
                additionalProperties: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    InternalServerError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Internal Server Error' }
            }
          }
        }
      }
    }
  },
  securitySchemes: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    }
  }
};

export default {
  CommonParameters,
  CommonResponses,
  DefaultOpenAPIComponents,
  isReferenceObject,
  isParameterObject,
  isResponseObject,
  isPostmanOperation
};
