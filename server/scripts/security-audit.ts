#!/usr/bin/env tsx

/**
 * Security Audit Script
 * Performs comprehensive security checks on the application
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface SecurityCheck {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class SecurityAuditor {
  private projectRoot: string;
  private checks: SecurityCheck[] = [];

  constructor() {
    this.projectRoot = join(__dirname, '..');
  }

  /**
   * Check for security vulnerabilities in dependencies
   */
  checkDependencyVulnerabilities(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check package.json for known vulnerable packages
      const packageJson = JSON.parse(
        readFileSync(join(this.projectRoot, 'package.json'), 'utf8')
      );

      // List of packages to avoid or check versions
      const vulnerablePackages = [
        'lodash', // Check for versions < 4.17.21
        'moment', // Recommend date-fns instead
        'request', // Deprecated
        'node-uuid', // Use uuid instead
      ];

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const pkg of vulnerablePackages) {
        if (dependencies[pkg]) {
          details.push(`⚠️  Found potentially vulnerable package: ${pkg}`);
          status = 'WARNING';
        }
      }

      // Check for security-focused packages
      const securityPackages = [
        'helmet',
        '@fastify/helmet',
        'argon2',
        'bcrypt',
        'jsonwebtoken',
        'rate-limiter-flexible',
        '@fastify/rate-limit',
        'express-validator',
        'zod',
      ];

      let securityPackagesFound = 0;
      for (const pkg of securityPackages) {
        if (dependencies[pkg]) {
          securityPackagesFound++;
          details.push(`✅ Security package found: ${pkg}`);
        }
      }

      if (securityPackagesFound < 3) {
        details.push('⚠️  Consider adding more security-focused packages');
        status = 'WARNING';
      }

      if (details.length === 0) {
        details.push('✅ No obvious dependency vulnerabilities found');
      }
    } catch (error) {
      details.push(`❌ Error checking dependencies: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Dependency Vulnerabilities',
      status,
      details,
      severity: 'HIGH',
    };
  }

  /**
   * Check environment variable security
   */
  checkEnvironmentSecurity(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for .env files
      const envFiles = [
        '.env',
        '.env.local',
        '.env.development',
        '.env.production',
        '.env.staging',
      ];

      for (const file of envFiles) {
        if (existsSync(join(this.projectRoot, file))) {
          const content = readFileSync(join(this.projectRoot, file), 'utf8');

          // Check for hardcoded secrets
          const secretPatterns = [
            /password\s*=\s*[^#\n]+/i,
            /secret\s*=\s*[^#\n]+/i,
            /key\s*=\s*[^#\n]+/i,
            /token\s*=\s*[^#\n]+/i,
          ];

          let hasHardcodedSecrets = false;
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              hasHardcodedSecrets = true;
              break;
            }
          }

          if (hasHardcodedSecrets) {
            details.push(`⚠️  ${file} may contain hardcoded secrets`);
            status = 'WARNING';
          } else {
            details.push(`✅ ${file} appears secure`);
          }
        }
      }

      // Check if .env is in .gitignore
      if (existsSync(join(this.projectRoot, '.gitignore'))) {
        const gitignore = readFileSync(
          join(this.projectRoot, '.gitignore'),
          'utf8'
        );
        if (gitignore.includes('.env')) {
          details.push('✅ .env files are properly ignored by git');
        } else {
          details.push('❌ .env files are not in .gitignore');
          status = 'FAIL';
        }
      }
    } catch (error) {
      details.push(`❌ Error checking environment security: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Environment Variable Security',
      status,
      details,
      severity: 'CRITICAL',
    };
  }

  /**
   * Check authentication and authorization implementation
   */
  checkAuthImplementation(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for JWT service
      const jwtServicePath = join(
        this.projectRoot,
        'src/infrastructure/security/jwt-service.ts'
      );
      if (existsSync(jwtServicePath)) {
        details.push('✅ JWT service implemented');

        const jwtContent = readFileSync(jwtServicePath, 'utf8');

        // Check for proper JWT configuration
        if (
          jwtContent.includes('expiresIn') &&
          jwtContent.includes('algorithm')
        ) {
          details.push(
            '✅ JWT properly configured with expiration and algorithm'
          );
        } else {
          details.push('⚠️  JWT configuration may be incomplete');
          status = 'WARNING';
        }
      } else {
        details.push('❌ JWT service not found');
        status = 'FAIL';
      }

      // Check for password service
      const passwordServicePath = join(
        this.projectRoot,
        'src/infrastructure/security/password-service.ts'
      );
      if (existsSync(passwordServicePath)) {
        details.push('✅ Password service implemented');

        const passwordContent = readFileSync(passwordServicePath, 'utf8');

        // Check for proper hashing
        if (
          passwordContent.includes('argon2') ||
          passwordContent.includes('bcrypt')
        ) {
          details.push('✅ Secure password hashing implemented');
        } else {
          details.push('❌ Secure password hashing not found');
          status = 'FAIL';
        }
      } else {
        details.push('❌ Password service not found');
        status = 'FAIL';
      }

      // Check for auth middleware
      const authMiddlewarePath = join(
        this.projectRoot,
        'src/infrastructure/security/auth-middleware.ts'
      );
      if (existsSync(authMiddlewarePath)) {
        details.push('✅ Authentication middleware implemented');
      } else {
        details.push('❌ Authentication middleware not found');
        status = 'FAIL';
      }
    } catch (error) {
      details.push(`❌ Error checking auth implementation: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Authentication & Authorization',
      status,
      details,
      severity: 'CRITICAL',
    };
  }

  /**
   * Check input validation and sanitization
   */
  checkInputValidation(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for input sanitizer
      const sanitizerPath = join(
        this.projectRoot,
        'src/infrastructure/security/input-sanitizer.ts'
      );
      if (existsSync(sanitizerPath)) {
        details.push('✅ Input sanitizer implemented');

        const sanitizerContent = readFileSync(sanitizerPath, 'utf8');

        // Check for XSS protection
        if (
          sanitizerContent.includes('DOMPurify') ||
          sanitizerContent.includes('xss')
        ) {
          details.push('✅ XSS protection implemented');
        } else {
          details.push('⚠️  XSS protection may be incomplete');
          status = 'WARNING';
        }

        // Check for SQL injection protection
        if (sanitizerContent.includes('sanitizeSqlInput')) {
          details.push('✅ SQL injection protection implemented');
        } else {
          details.push('⚠️  SQL injection protection may be incomplete');
          status = 'WARNING';
        }
      } else {
        details.push('❌ Input sanitizer not found');
        status = 'FAIL';
      }

      // Check for validation middleware
      const validationPath = join(
        this.projectRoot,
        'src/presentation/middleware/validation-middleware.ts'
      );
      if (existsSync(validationPath)) {
        details.push('✅ Validation middleware implemented');

        const validationContent = readFileSync(validationPath, 'utf8');

        // Check for Zod usage
        if (
          validationContent.includes('zod') ||
          validationContent.includes('ZodSchema')
        ) {
          details.push('✅ Schema validation with Zod implemented');
        } else {
          details.push('⚠️  Schema validation may be incomplete');
          status = 'WARNING';
        }
      } else {
        details.push('❌ Validation middleware not found');
        status = 'FAIL';
      }
    } catch (error) {
      details.push(`❌ Error checking input validation: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Input Validation & Sanitization',
      status,
      details,
      severity: 'HIGH',
    };
  }

  /**
   * Check security headers and CORS configuration
   */
  checkSecurityHeaders(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for security middleware
      const securityMiddlewarePath = join(
        this.projectRoot,
        'src/presentation/middleware/security-middleware.ts'
      );
      if (existsSync(securityMiddlewarePath)) {
        details.push('✅ Security middleware implemented');

        const securityContent = readFileSync(securityMiddlewarePath, 'utf8');

        // Check for security headers
        const securityHeaders = [
          'Content-Security-Policy',
          'Strict-Transport-Security',
          'X-Content-Type-Options',
          'X-Frame-Options',
          'X-XSS-Protection',
        ];

        let headersFound = 0;
        for (const header of securityHeaders) {
          if (securityContent.includes(header)) {
            headersFound++;
          }
        }

        if (headersFound >= 4) {
          details.push(
            `✅ Security headers implemented (${headersFound}/${securityHeaders.length})`
          );
        } else {
          details.push(
            `⚠️  Some security headers missing (${headersFound}/${securityHeaders.length})`
          );
          status = 'WARNING';
        }
      } else {
        details.push('❌ Security middleware not found');
        status = 'FAIL';
      }

      // Check for CORS middleware
      const corsMiddlewarePath = join(
        this.projectRoot,
        'src/presentation/middleware/cors-middleware.ts'
      );
      if (existsSync(corsMiddlewarePath)) {
        details.push('✅ CORS middleware implemented');

        const corsContent = readFileSync(corsMiddlewarePath, 'utf8');

        // Check for proper origin validation
        if (
          corsContent.includes('origin') &&
          corsContent.includes('function')
        ) {
          details.push('✅ Dynamic origin validation implemented');
        } else {
          details.push('⚠️  Consider implementing dynamic origin validation');
          status = 'WARNING';
        }
      } else {
        details.push('❌ CORS middleware not found');
        status = 'FAIL';
      }
    } catch (error) {
      details.push(`❌ Error checking security headers: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Security Headers & CORS',
      status,
      details,
      severity: 'HIGH',
    };
  }

  /**
   * Check rate limiting implementation
   */
  checkRateLimiting(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for rate limit service
      const rateLimitPath = join(
        this.projectRoot,
        'src/infrastructure/security/rate-limit-service.ts'
      );
      if (existsSync(rateLimitPath)) {
        details.push('✅ Rate limiting service implemented');

        const rateLimitContent = readFileSync(rateLimitPath, 'utf8');

        // Check for Redis integration
        if (
          rateLimitContent.includes('redis') ||
          rateLimitContent.includes('Redis')
        ) {
          details.push('✅ Redis-based rate limiting implemented');
        } else {
          details.push(
            '⚠️  Consider using Redis for distributed rate limiting'
          );
          status = 'WARNING';
        }
      } else {
        details.push('❌ Rate limiting service not found');
        status = 'FAIL';
      }

      // Check for rate limit middleware
      const rateLimitMiddlewarePath = join(
        this.projectRoot,
        'src/presentation/middleware/rate-limit-middleware.ts'
      );
      if (existsSync(rateLimitMiddlewarePath)) {
        details.push('✅ Rate limiting middleware implemented');
      } else {
        details.push('❌ Rate limiting middleware not found');
        status = 'FAIL';
      }
    } catch (error) {
      details.push(`❌ Error checking rate limiting: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Rate Limiting',
      status,
      details,
      severity: 'MEDIUM',
    };
  }

  /**
   * Check audit logging implementation
   */
  checkAuditLogging(): SecurityCheck {
    const details: string[] = [];
    let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';

    try {
      // Check for audit logger
      const auditLoggerPath = join(
        this.projectRoot,
        'src/infrastructure/security/audit-logger.ts'
      );
      if (existsSync(auditLoggerPath)) {
        details.push('✅ Audit logging service implemented');

        const auditContent = readFileSync(auditLoggerPath, 'utf8');

        // Check for comprehensive event types
        const eventTypes = [
          'LOGIN_SUCCESS',
          'LOGIN_FAILURE',
          'ACCESS_DENIED',
          'SUSPICIOUS_ACTIVITY',
          'XSS_ATTEMPT',
          'SQL_INJECTION_ATTEMPT',
        ];

        let eventsFound = 0;
        for (const event of eventTypes) {
          if (auditContent.includes(event)) {
            eventsFound++;
          }
        }

        if (eventsFound >= 5) {
          details.push(
            `✅ Comprehensive audit events implemented (${eventsFound}/${eventTypes.length})`
          );
        } else {
          details.push(
            `⚠️  Some audit events missing (${eventsFound}/${eventTypes.length})`
          );
          status = 'WARNING';
        }
      } else {
        details.push('❌ Audit logging service not found');
        status = 'FAIL';
      }
    } catch (error) {
      details.push(`❌ Error checking audit logging: ${error}`);
      status = 'FAIL';
    }

    return {
      name: 'Audit Logging',
      status,
      details,
      severity: 'MEDIUM',
    };
  }

  /**
   * Run all security checks
   */
  async runSecurityAudit(): Promise<void> {
    console.log('🔒 SECURITY AUDIT REPORT');
    console.log('========================');
    console.log();

    const checks = [
      this.checkDependencyVulnerabilities(),
      this.checkEnvironmentSecurity(),
      this.checkAuthImplementation(),
      this.checkInputValidation(),
      this.checkSecurityHeaders(),
      this.checkRateLimiting(),
      this.checkAuditLogging(),
    ];

    this.checks = checks;

    for (const check of checks) {
      const statusIcon =
        check.status === 'PASS'
          ? '✅'
          : check.status === 'WARNING'
            ? '⚠️'
            : '❌';

      const severityColor =
        check.severity === 'CRITICAL'
          ? '\x1b[31m'
          : check.severity === 'HIGH'
            ? '\x1b[33m'
            : check.severity === 'MEDIUM'
              ? '\x1b[36m'
              : '\x1b[32m';

      console.log(
        `${statusIcon} ${check.name} - ${severityColor}${check.severity}\x1b[0m`
      );

      for (const detail of check.details) {
        console.log(`   ${detail}`);
      }
      console.log();
    }

    this.generateSecuritySummary();
  }

  /**
   * Generate security summary
   */
  private generateSecuritySummary(): void {
    const passed = this.checks.filter(c => c.status === 'PASS').length;
    const warnings = this.checks.filter(c => c.status === 'WARNING').length;
    const failed = this.checks.filter(c => c.status === 'FAIL').length;
    const total = this.checks.length;

    const criticalIssues = this.checks.filter(
      c => c.severity === 'CRITICAL' && c.status !== 'PASS'
    ).length;
    const highIssues = this.checks.filter(
      c => c.severity === 'HIGH' && c.status !== 'PASS'
    ).length;

    console.log('📊 SECURITY SUMMARY');
    console.log('==================');
    console.log();
    console.log(`Total Checks: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${failed}`);
    console.log();
    console.log(`🚨 Critical Issues: ${criticalIssues}`);
    console.log(`⚠️  High Priority Issues: ${highIssues}`);
    console.log();

    if (criticalIssues === 0 && highIssues === 0) {
      console.log(
        '🎉 EXCELLENT! No critical or high-priority security issues found.'
      );
      console.log('   Your application has strong security measures in place.');
    } else if (criticalIssues === 0) {
      console.log(
        '✅ GOOD! No critical security issues, but address high-priority items.'
      );
    } else {
      console.log(
        '🚨 ATTENTION REQUIRED! Critical security issues must be addressed immediately.'
      );
    }

    console.log();
    console.log('💡 RECOMMENDATIONS:');
    console.log(
      '- Regularly update dependencies to patch security vulnerabilities'
    );
    console.log('- Implement comprehensive logging and monitoring');
    console.log('- Conduct regular security audits and penetration testing');
    console.log('- Keep security configurations up to date');
    console.log('- Train development team on secure coding practices');
  }
}

// Main execution
async function main() {
  const auditor = new SecurityAuditor();
  await auditor.runSecurityAudit();
}

main().catch(error => {
  console.error(`Security audit failed: ${error.message}`);
  process.exit(1);
});
