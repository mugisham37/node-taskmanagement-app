---
name: Security Report
about: Report a security vulnerability (use this for non-critical issues only)
title: '[SECURITY] '
labels: ['security', 'needs-triage']
assignees: ''
---

## ⚠️ Security Vulnerability Report

**IMPORTANT:** If this is a critical security vulnerability that could be exploited, please DO NOT create a public issue. Instead, please email us directly at security@taskmanagement.app or use GitHub's private vulnerability reporting feature.

## Vulnerability Description

A clear and concise description of the security vulnerability.

## Affected Components

- [ ] Web Application
- [ ] Admin Dashboard
- [ ] Mobile Application
- [ ] API Server
- [ ] Database
- [ ] Infrastructure
- [ ] Third-party Dependencies

## Vulnerability Type

- [ ] Authentication/Authorization
- [ ] Input Validation
- [ ] Cross-Site Scripting (XSS)
- [ ] SQL Injection
- [ ] Cross-Site Request Forgery (CSRF)
- [ ] Insecure Direct Object References
- [ ] Security Misconfiguration
- [ ] Sensitive Data Exposure
- [ ] Insufficient Logging & Monitoring
- [ ] Other: _______________

## Severity Assessment

**CVSS Score (if known):** [e.g., 7.5]

**Severity Level:**
- [ ] Critical (9.0-10.0) - Immediate action required
- [ ] High (7.0-8.9) - Fix within 24-48 hours
- [ ] Medium (4.0-6.9) - Fix within 1 week
- [ ] Low (0.1-3.9) - Fix within 1 month
- [ ] Informational (0.0) - No immediate fix required

## Steps to Reproduce

1. Go to '...'
2. Perform action '....'
3. Observe security issue '....'

**Note:** Please be responsible and do not exploit this vulnerability beyond what's necessary to demonstrate the issue.

## Proof of Concept

Provide a minimal proof of concept that demonstrates the vulnerability:

```
# Example code or steps here
```

## Impact

Describe the potential impact of this vulnerability:

- **Confidentiality:** [None/Low/Medium/High]
- **Integrity:** [None/Low/Medium/High]
- **Availability:** [None/Low/Medium/High]

**Detailed Impact:**
- What data could be accessed?
- What actions could an attacker perform?
- How many users could be affected?

## Affected Versions

- **Current Version:** [e.g., v1.2.3]
- **First Affected Version:** [e.g., v1.0.0]
- **Environment:** [Production/Staging/Development]

## Suggested Fix

If you have suggestions on how to fix this vulnerability, please describe them here:

```
# Suggested code changes or configuration updates
```

## References

- [OWASP Reference](https://owasp.org/)
- [CVE Database](https://cve.mitre.org/)
- Other relevant security resources

## Reporter Information

**Contact Information (optional):**
- Name: [Your name or handle]
- Email: [Your email for follow-up]
- Organization: [If reporting on behalf of an organization]

**Disclosure Timeline:**
- [ ] I agree to responsible disclosure practices
- [ ] I will not publicly disclose this vulnerability until it's fixed
- [ ] I would like to be credited in the security advisory (optional)

## Additional Context

Add any other context about the security vulnerability here.

## Checklist

- [ ] I have verified this is a legitimate security issue
- [ ] I have not exploited this vulnerability maliciously
- [ ] I have provided sufficient information to reproduce the issue
- [ ] I understand this will be handled according to responsible disclosure practices
- [ ] I have checked that this vulnerability hasn't been reported before