export interface AuditContextProps {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export class AuditContext {
  private constructor(private props: AuditContextProps) {}

  static create(props: AuditContextProps): AuditContext {
    return new AuditContext(props);
  }

  static fromRequest(request: {
    user?: { id: string; email: string };
    ip?: string;
    headers?: { 'user-agent'?: string };
    sessionId?: string;
    requestId?: string;
  }): AuditContext {
    return new AuditContext({
      userId: request.user?.id,
      userEmail: request.user?.email,
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
      sessionId: request.sessionId,
      requestId: request.requestId,
    });
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get userEmail(): string | undefined {
    return this.props.userEmail;
  }

  get ipAddress(): string | undefined {
    return this.props.ipAddress;
  }

  get userAgent(): string | undefined {
    return this.props.userAgent;
  }

  get sessionId(): string | undefined {
    return this.props.sessionId;
  }

  get requestId(): string | undefined {
    return this.props.requestId;
  }

  hasUser(): boolean {
    return !!this.props.userId;
  }

  toMetadata(): Record<string, any> {
    return {
      sessionId: this.props.sessionId,
      requestId: this.props.requestId,
      hasUser: this.hasUser(),
    };
  }

  toPrimitive(): AuditContextProps {
    return { ...this.props };
  }
}
