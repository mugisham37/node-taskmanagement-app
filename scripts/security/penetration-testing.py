#!/usr/bin/env python3
"""
Automated Penetration Testing Script
Performs basic security testing against the task management application
"""

import requests
import json
import time
import random
import string
import sys
from urllib.parse import urljoin
from datetime import datetime
import argparse

class PenetrationTester:
    def __init__(self, base_url, output_file='penetration-test-report.html'):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.results = []
        self.output_file = output_file
        
        # Common payloads for testing
        self.sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "' OR 1=1 --"
        ]
        
        self.xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "';alert('XSS');//"
        ]
        
        self.command_injection_payloads = [
            "; ls -la",
            "| whoami",
            "&& cat /etc/passwd",
            "; cat /etc/shadow",
            "| id"
        ]

    def log_result(self, test_name, status, details, severity='medium'):
        """Log test result"""
        result = {
            'timestamp': datetime.now().isoformat(),
            'test_name': test_name,
            'status': status,
            'severity': severity,
            'details': details
        }
        self.results.append(result)
        print(f"[{status.upper()}] {test_name}: {details}")

    def test_sql_injection(self):
        """Test for SQL injection vulnerabilities"""
        print("\n=== Testing SQL Injection ===")
        
        # Test login endpoint
        login_url = urljoin(self.base_url, '/api/auth/login')
        
        for payload in self.sql_payloads:
            try:
                data = {
                    'email': f"admin{payload}",
                    'password': 'password'
                }
                
                response = self.session.post(login_url, json=data, timeout=10)
                
                # Check for SQL error messages
                error_indicators = [
                    'sql syntax',
                    'mysql_fetch',
                    'postgresql',
                    'ora-',
                    'microsoft jet database',
                    'sqlite_',
                    'syntax error'
                ]
                
                response_text = response.text.lower()
                for indicator in error_indicators:
                    if indicator in response_text:
                        self.log_result(
                            'SQL Injection - Login',
                            'VULNERABLE',
                            f'SQL error detected with payload: {payload}',
                            'critical'
                        )
                        return
                
                # Check for successful bypass (status 200 with token)
                if response.status_code == 200 and 'token' in response.text:
                    self.log_result(
                        'SQL Injection - Authentication Bypass',
                        'VULNERABLE',
                        f'Authentication bypassed with payload: {payload}',
                        'critical'
                    )
                    return
                    
            except Exception as e:
                self.log_result(
                    'SQL Injection Test Error',
                    'ERROR',
                    f'Error testing payload {payload}: {str(e)}',
                    'low'
                )
        
        self.log_result(
            'SQL Injection - Login',
            'SECURE',
            'No SQL injection vulnerabilities detected in login endpoint',
            'info'
        )

    def test_xss_vulnerabilities(self):
        """Test for Cross-Site Scripting vulnerabilities"""
        print("\n=== Testing XSS Vulnerabilities ===")
        
        # First, try to authenticate
        auth_token = self.authenticate()
        if not auth_token:
            self.log_result(
                'XSS Testing',
                'SKIPPED',
                'Could not authenticate - skipping XSS tests',
                'low'
            )
            return
        
        # Test task creation endpoint
        create_task_url = urljoin(self.base_url, '/api/tasks')
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        for payload in self.xss_payloads:
            try:
                data = {
                    'title': f'Test Task {payload}',
                    'description': f'Description with XSS: {payload}',
                    'projectId': '123'
                }
                
                response = self.session.post(create_task_url, json=data, headers=headers, timeout=10)
                
                # Check if payload is reflected without encoding
                if payload in response.text and response.status_code in [200, 201]:
                    self.log_result(
                        'XSS - Task Creation',
                        'VULNERABLE',
                        f'XSS payload reflected: {payload}',
                        'high'
                    )
                    return
                    
            except Exception as e:
                self.log_result(
                    'XSS Test Error',
                    'ERROR',
                    f'Error testing XSS payload {payload}: {str(e)}',
                    'low'
                )
        
        self.log_result(
            'XSS - Task Creation',
            'SECURE',
            'No XSS vulnerabilities detected in task creation',
            'info'
        )

    def test_authentication_security(self):
        """Test authentication security measures"""
        print("\n=== Testing Authentication Security ===")
        
        # Test brute force protection
        login_url = urljoin(self.base_url, '/api/auth/login')
        
        # Attempt multiple failed logins
        failed_attempts = 0
        for i in range(10):
            try:
                data = {
                    'email': 'test@example.com',
                    'password': f'wrongpassword{i}'
                }
                
                response = self.session.post(login_url, json=data, timeout=10)
                
                if response.status_code == 401:
                    failed_attempts += 1
                elif response.status_code == 429:
                    self.log_result(
                        'Brute Force Protection',
                        'SECURE',
                        f'Rate limiting activated after {failed_attempts} attempts',
                        'info'
                    )
                    break
                    
            except Exception as e:
                self.log_result(
                    'Authentication Test Error',
                    'ERROR',
                    f'Error during brute force test: {str(e)}',
                    'low'
                )
                break
        else:
            self.log_result(
                'Brute Force Protection',
                'VULNERABLE',
                f'No rate limiting detected after {failed_attempts} failed attempts',
                'medium'
            )

    def test_authorization_bypass(self):
        """Test for authorization bypass vulnerabilities"""
        print("\n=== Testing Authorization Bypass ===")
        
        # Test accessing admin endpoints without proper authorization
        admin_endpoints = [
            '/api/admin/users',
            '/api/admin/system/health',
            '/api/admin/analytics',
            '/api/admin/settings'
        ]
        
        for endpoint in admin_endpoints:
            try:
                url = urljoin(self.base_url, endpoint)
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 200:
                    self.log_result(
                        'Authorization Bypass',
                        'VULNERABLE',
                        f'Admin endpoint accessible without authentication: {endpoint}',
                        'critical'
                    )
                elif response.status_code in [401, 403]:
                    self.log_result(
                        'Authorization Check',
                        'SECURE',
                        f'Admin endpoint properly protected: {endpoint}',
                        'info'
                    )
                    
            except Exception as e:
                self.log_result(
                    'Authorization Test Error',
                    'ERROR',
                    f'Error testing endpoint {endpoint}: {str(e)}',
                    'low'
                )

    def test_input_validation(self):
        """Test input validation and sanitization"""
        print("\n=== Testing Input Validation ===")
        
        auth_token = self.authenticate()
        if not auth_token:
            self.log_result(
                'Input Validation Testing',
                'SKIPPED',
                'Could not authenticate - skipping input validation tests',
                'low'
            )
            return
        
        headers = {'Authorization': f'Bearer {auth_token}'}
        
        # Test with oversized inputs
        large_string = 'A' * 10000
        
        endpoints_to_test = [
            ('/api/tasks', {'title': large_string, 'description': 'test'}),
            ('/api/projects', {'name': large_string, 'description': 'test'}),
            ('/api/users/profile', {'firstName': large_string, 'lastName': 'test'})
        ]
        
        for endpoint, data in endpoints_to_test:
            try:
                url = urljoin(self.base_url, endpoint)
                response = self.session.post(url, json=data, headers=headers, timeout=10)
                
                if response.status_code == 500:
                    self.log_result(
                        'Input Validation - Buffer Overflow',
                        'VULNERABLE',
                        f'Server error with large input on {endpoint}',
                        'medium'
                    )
                elif response.status_code == 400:
                    self.log_result(
                        'Input Validation',
                        'SECURE',
                        f'Proper input validation on {endpoint}',
                        'info'
                    )
                    
            except Exception as e:
                self.log_result(
                    'Input Validation Test Error',
                    'ERROR',
                    f'Error testing {endpoint}: {str(e)}',
                    'low'
                )

    def test_session_management(self):
        """Test session management security"""
        print("\n=== Testing Session Management ===")
        
        # Test JWT token security
        auth_token = self.authenticate()
        if not auth_token:
            return
        
        # Test token without signature
        try:
            parts = auth_token.split('.')
            if len(parts) == 3:
                # Remove signature
                tampered_token = f"{parts[0]}.{parts[1]}."
                
                headers = {'Authorization': f'Bearer {tampered_token}'}
                response = self.session.get(
                    urljoin(self.base_url, '/api/users/profile'),
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    self.log_result(
                        'JWT Security',
                        'VULNERABLE',
                        'JWT token accepted without valid signature',
                        'critical'
                    )
                else:
                    self.log_result(
                        'JWT Security',
                        'SECURE',
                        'JWT signature validation working properly',
                        'info'
                    )
                    
        except Exception as e:
            self.log_result(
                'Session Management Test Error',
                'ERROR',
                f'Error testing JWT security: {str(e)}',
                'low'
            )

    def test_information_disclosure(self):
        """Test for information disclosure vulnerabilities"""
        print("\n=== Testing Information Disclosure ===")
        
        # Test for exposed sensitive endpoints
        sensitive_endpoints = [
            '/.env',
            '/config.json',
            '/package.json',
            '/api/debug',
            '/api/health',
            '/swagger.json',
            '/api-docs'
        ]
        
        for endpoint in sensitive_endpoints:
            try:
                url = urljoin(self.base_url, endpoint)
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 200:
                    # Check for sensitive information
                    sensitive_patterns = [
                        'password',
                        'secret',
                        'key',
                        'token',
                        'database',
                        'connection'
                    ]
                    
                    response_text = response.text.lower()
                    for pattern in sensitive_patterns:
                        if pattern in response_text:
                            self.log_result(
                                'Information Disclosure',
                                'VULNERABLE',
                                f'Sensitive information exposed at {endpoint}',
                                'medium'
                            )
                            break
                    else:
                        self.log_result(
                            'Information Disclosure',
                            'INFO',
                            f'Endpoint accessible but no sensitive data detected: {endpoint}',
                            'low'
                        )
                        
            except Exception as e:
                self.log_result(
                    'Information Disclosure Test Error',
                    'ERROR',
                    f'Error testing {endpoint}: {str(e)}',
                    'low'
                )

    def test_security_headers(self):
        """Test for security headers"""
        print("\n=== Testing Security Headers ===")
        
        try:
            response = self.session.get(self.base_url, timeout=10)
            headers = response.headers
            
            # Check for important security headers
            security_headers = {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': None,
                'Content-Security-Policy': None,
                'Referrer-Policy': None
            }
            
            missing_headers = []
            for header, expected_value in security_headers.items():
                if header not in headers:
                    missing_headers.append(header)
                elif expected_value and isinstance(expected_value, list):
                    if headers[header] not in expected_value:
                        missing_headers.append(f"{header} (incorrect value)")
                elif expected_value and headers[header] != expected_value:
                    missing_headers.append(f"{header} (incorrect value)")
            
            if missing_headers:
                self.log_result(
                    'Security Headers',
                    'VULNERABLE',
                    f'Missing or incorrect security headers: {", ".join(missing_headers)}',
                    'medium'
                )
            else:
                self.log_result(
                    'Security Headers',
                    'SECURE',
                    'All important security headers present and configured correctly',
                    'info'
                )
                
        except Exception as e:
            self.log_result(
                'Security Headers Test Error',
                'ERROR',
                f'Error testing security headers: {str(e)}',
                'low'
            )

    def authenticate(self):
        """Attempt to authenticate and return token"""
        try:
            login_url = urljoin(self.base_url, '/api/auth/login')
            data = {
                'email': 'test@example.com',
                'password': 'testpassword123'
            }
            
            response = self.session.post(login_url, json=data, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                return result.get('token') or result.get('accessToken')
            
        except Exception as e:
            self.log_result(
                'Authentication Error',
                'ERROR',
                f'Could not authenticate: {str(e)}',
                'low'
            )
        
        return None

    def generate_report(self):
        """Generate HTML report of test results"""
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Penetration Testing Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
                .summary { margin: 20px 0; }
                .result { margin: 10px 0; padding: 10px; border-radius: 5px; }
                .critical { background-color: #ffebee; border-left: 5px solid #f44336; }
                .high { background-color: #fff3e0; border-left: 5px solid #ff9800; }
                .medium { background-color: #f3e5f5; border-left: 5px solid #9c27b0; }
                .low { background-color: #e8f5e8; border-left: 5px solid #4caf50; }
                .info { background-color: #e3f2fd; border-left: 5px solid #2196f3; }
                .vulnerable { background-color: #ffcdd2; }
                .secure { background-color: #c8e6c9; }
                .error { background-color: #ffecb3; }
                .timestamp { font-size: 0.8em; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Penetration Testing Report</h1>
                <p><strong>Target:</strong> {target}</p>
                <p><strong>Generated:</strong> {timestamp}</p>
            </div>
            
            <div class="summary">
                <h2>Summary</h2>
                <p><strong>Total Tests:</strong> {total_tests}</p>
                <p><strong>Critical Issues:</strong> {critical_count}</p>
                <p><strong>High Issues:</strong> {high_count}</p>
                <p><strong>Medium Issues:</strong> {medium_count}</p>
                <p><strong>Low Issues:</strong> {low_count}</p>
            </div>
            
            <div class="results">
                <h2>Detailed Results</h2>
                {results_html}
            </div>
        </body>
        </html>
        """
        
        # Count results by severity
        severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        for result in self.results:
            severity = result.get('severity', 'low')
            if severity in severity_counts:
                severity_counts[severity] += 1
        
        # Generate results HTML
        results_html = ""
        for result in self.results:
            severity = result.get('severity', 'low')
            status = result.get('status', 'unknown').lower()
            
            css_class = f"{severity} {status}"
            
            results_html += f"""
            <div class="result {css_class}">
                <h3>{result['test_name']}</h3>
                <p><strong>Status:</strong> {result['status']}</p>
                <p><strong>Severity:</strong> {result['severity'].upper()}</p>
                <p><strong>Details:</strong> {result['details']}</p>
                <p class="timestamp">{result['timestamp']}</p>
            </div>
            """
        
        # Generate final HTML
        html_content = html_template.format(
            target=self.base_url,
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            total_tests=len(self.results),
            critical_count=severity_counts['critical'],
            high_count=severity_counts['high'],
            medium_count=severity_counts['medium'],
            low_count=severity_counts['low'],
            results_html=results_html
        )
        
        # Write report to file
        with open(self.output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"\nReport generated: {self.output_file}")

    def run_all_tests(self):
        """Run all penetration tests"""
        print(f"Starting penetration testing against: {self.base_url}")
        print("=" * 60)
        
        # Run all test methods
        test_methods = [
            self.test_sql_injection,
            self.test_xss_vulnerabilities,
            self.test_authentication_security,
            self.test_authorization_bypass,
            self.test_input_validation,
            self.test_session_management,
            self.test_information_disclosure,
            self.test_security_headers
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                self.log_result(
                    f'Test Error - {test_method.__name__}',
                    'ERROR',
                    f'Unexpected error: {str(e)}',
                    'low'
                )
        
        # Generate report
        self.generate_report()
        
        # Print summary
        print("\n" + "=" * 60)
        print("PENETRATION TESTING COMPLETE")
        print("=" * 60)
        
        critical_issues = [r for r in self.results if r.get('severity') == 'critical' and r.get('status') == 'VULNERABLE']
        high_issues = [r for r in self.results if r.get('severity') == 'high' and r.get('status') == 'VULNERABLE']
        
        if critical_issues:
            print(f"🚨 CRITICAL: {len(critical_issues)} critical security issues found!")
            for issue in critical_issues:
                print(f"   - {issue['test_name']}: {issue['details']}")
        
        if high_issues:
            print(f"⚠️  HIGH: {len(high_issues)} high-severity security issues found!")
            for issue in high_issues:
                print(f"   - {issue['test_name']}: {issue['details']}")
        
        if not critical_issues and not high_issues:
            print("✅ No critical or high-severity vulnerabilities detected!")
        
        print(f"\nDetailed report saved to: {self.output_file}")

def main():
    parser = argparse.ArgumentParser(description='Automated Penetration Testing Tool')
    parser.add_argument('--target', '-t', required=True, help='Target URL (e.g., http://localhost:3000)')
    parser.add_argument('--output', '-o', default='penetration-test-report.html', help='Output report file')
    
    args = parser.parse_args()
    
    # Create tester instance and run tests
    tester = PenetrationTester(args.target, args.output)
    tester.run_all_tests()

if __name__ == '__main__':
    main()