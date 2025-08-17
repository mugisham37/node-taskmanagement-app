#!/usr/bin/env node

/**
 * Security Quality Gate Script
 * Evaluates security test results and determines if deployment should proceed
 */

const fs = require('fs');
const path = require('path');

class SecurityQualityGate {
  constructor() {
    this.results = {
      vulnerabilityScanning: null,
      sastResults: null,
      containerScanning: null,
      secretsScanning: null,
      infrastructureScanning: null,
      penetrationTesting: null,
      complianceChecks: null
    };
    
    this.thresholds = {
      critical: 0,        // No critical vulnerabilities allowed
      high: 2,           // Maximum 2 high-severity issues
      medium: 10,        // Maximum 10 medium-severity issues
      low: 50,           // Maximum 50 low-severity issues
      coverageMin: 80,   // Minimum security test coverage
      complianceMin: 95  // Minimum compliance score
    };
    
    this.findings = [];
    this.passed = true;
    this.score = 0;
  }

  async evaluateSecurityResults() {
    console.log('🔒 Evaluating Security Quality Gate...\n');

    try {
      // Load all security scan results
      await this.loadResults();
      
      // Evaluate each security domain
      this.evaluateVulnerabilityScanning();
      this.evaluateSASTResults();
      this.evaluateContainerScanning();
      this.evaluateSecretsScanning();
      this.evaluateInfrastructureScanning();
      this.evaluatePenetrationTesting();
      this.evaluateComplianceChecks();
      
      // Calculate overall security score
      this.calculateSecurityScore();
      
      // Generate final report
      this.generateReport();
      
      // Determine gate status
      this.determineGateStatus();
      
    } catch (error) {
      console.error('❌ Error evaluating security quality gate:', error.message);
      this.addFinding('CRITICAL', 'Security evaluation failed', error.message);
      this.passed = false;
    }
  }

  async loadResults() {
    console.log('📂 Loading security scan results...');
    
    const resultFiles = {
      vulnerabilityScanning: [
        'security-scan-results/npm-audit-results.json',
        'security-scan-results/snyk-results.json'
      ],
      sastResults: [
        'eslint-results.sarif',
        'codeql-results.sarif'
      ],
      containerScanning: [
        'trivy-api-results.sarif',
        'trivy-web-results.sarif',
        'trivy-admin-results.sarif'
      ],
      secretsScanning: [
        'trufflehog-results.json',
        'gitleaks-results.json'
      ],
      infrastructureScanning: [
        'checkov-terraform-results.sarif',
        'checkov-k8s-results.sarif'
      ],
      penetrationTesting: [
        'penetration-test-results/nuclei-results.json',
        'penetration-test-results/nikto-results.xml',
        'penetration-test-report.html'
      ],
      complianceChecks: [
        'compliance-results.json'
      ]
    };

    for (const [category, files] of Object.entries(resultFiles)) {
      this.results[category] = await this.loadResultFiles(files);
    }
  }

  async loadResultFiles(files) {
    const results = [];
    
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          if (file.endsWith('.json')) {
            results.push(JSON.parse(content));
          } else if (file.endsWith('.sarif')) {
            results.push(JSON.parse(content));
          } else if (file.endsWith('.xml')) {
            results.push({ xml: content, file });
          } else {
            results.push({ content, file });
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not load ${file}: ${error.message}`);
      }
    }
    
    return results;
  }

  evaluateVulnerabilityScanning() {
    console.log('🔍 Evaluating vulnerability scanning results...');
    
    let totalVulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // Process npm audit results
    const npmResults = this.results.vulnerabilityScanning.find(r => r.vulnerabilities);
    if (npmResults && npmResults.vulnerabilities) {
      for (const [name, vuln] of Object.entries(npmResults.vulnerabilities)) {
        const severity = vuln.severity || 'low';
        totalVulnerabilities[severity] = (totalVulnerabilities[severity] || 0) + 1;
      }
    }

    // Process Snyk results
    const snykResults = this.results.vulnerabilityScanning.find(r => r.vulnerabilities && Array.isArray(r.vulnerabilities));
    if (snykResults && snykResults.vulnerabilities) {
      snykResults.vulnerabilities.forEach(vuln => {
        const severity = vuln.severity || 'low';
        totalVulnerabilities[severity] = (totalVulnerabilities[severity] || 0) + 1;
      });
    }

    // Evaluate against thresholds
    this.evaluateVulnerabilityThresholds('Dependency Vulnerabilities', totalVulnerabilities);
  }

  evaluateSASTResults() {
    console.log('🔍 Evaluating SAST results...');
    
    let totalIssues = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // Process SARIF results
    this.results.sastResults.forEach(result => {
      if (result.runs) {
        result.runs.forEach(run => {
          if (run.results) {
            run.results.forEach(finding => {
              const level = finding.level || 'note';
              let severity = 'low';
              
              switch (level) {
                case 'error':
                  severity = 'high';
                  break;
                case 'warning':
                  severity = 'medium';
                  break;
                case 'info':
                case 'note':
                  severity = 'low';
                  break;
              }
              
              totalIssues[severity]++;
            });
          }
        });
      }
    });

    this.evaluateVulnerabilityThresholds('SAST Issues', totalIssues);
  }

  evaluateContainerScanning() {
    console.log('🔍 Evaluating container scanning results...');
    
    let totalVulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // Process Trivy SARIF results
    this.results.containerScanning.forEach(result => {
      if (result.runs) {
        result.runs.forEach(run => {
          if (run.results) {
            run.results.forEach(finding => {
              const properties = finding.properties || {};
              const severity = properties.security_severity || 'low';
              
              if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
                totalVulnerabilities[severity]++;
              }
            });
          }
        });
      }
    });

    this.evaluateVulnerabilityThresholds('Container Vulnerabilities', totalVulnerabilities);
  }

  evaluateSecretsScanning() {
    console.log('🔍 Evaluating secrets scanning results...');
    
    let secretsFound = 0;
    
    // Process TruffleHog results
    this.results.secretsScanning.forEach(result => {
      if (Array.isArray(result)) {
        secretsFound += result.length;
      } else if (result.results && Array.isArray(result.results)) {
        secretsFound += result.results.length;
      }
    });

    if (secretsFound > 0) {
      this.addFinding('CRITICAL', 'Secrets Detected', `Found ${secretsFound} potential secrets in code`);
      this.passed = false;
    } else {
      console.log('✅ No secrets detected');
    }
  }

  evaluateInfrastructureScanning() {
    console.log('🔍 Evaluating infrastructure scanning results...');
    
    let totalIssues = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // Process Checkov SARIF results
    this.results.infrastructureScanning.forEach(result => {
      if (result.runs) {
        result.runs.forEach(run => {
          if (run.results) {
            run.results.forEach(finding => {
              const level = finding.level || 'note';
              let severity = 'low';
              
              switch (level) {
                case 'error':
                  severity = 'high';
                  break;
                case 'warning':
                  severity = 'medium';
                  break;
                case 'info':
                case 'note':
                  severity = 'low';
                  break;
              }
              
              totalIssues[severity]++;
            });
          }
        });
      }
    });

    this.evaluateVulnerabilityThresholds('Infrastructure Issues', totalIssues);
  }

  evaluatePenetrationTesting() {
    console.log('🔍 Evaluating penetration testing results...');
    
    // Check if penetration testing was performed
    if (this.results.penetrationTesting.length === 0) {
      this.addFinding('MEDIUM', 'Penetration Testing', 'No penetration testing results found');
      return;
    }

    // Parse HTML report for vulnerabilities
    const htmlReport = this.results.penetrationTesting.find(r => r.content && r.file.includes('.html'));
    if (htmlReport) {
      const content = htmlReport.content;
      
      // Simple parsing for vulnerability indicators
      const criticalMatches = (content.match(/critical/gi) || []).length;
      const highMatches = (content.match(/high/gi) || []).length;
      const vulnerableMatches = (content.match(/vulnerable/gi) || []).length;
      
      if (criticalMatches > 5 || vulnerableMatches > 10) {
        this.addFinding('HIGH', 'Penetration Testing', 'Multiple vulnerabilities detected in penetration test');
      } else if (highMatches > 3) {
        this.addFinding('MEDIUM', 'Penetration Testing', 'Some security issues detected in penetration test');
      } else {
        console.log('✅ Penetration testing passed');
      }
    }
  }

  evaluateComplianceChecks() {
    console.log('🔍 Evaluating compliance checks...');
    
    const complianceResults = this.results.complianceChecks.find(r => r.frameworks);
    if (!complianceResults) {
      this.addFinding('MEDIUM', 'Compliance', 'No compliance check results found');
      return;
    }

    // Check compliance scores
    if (complianceResults.frameworks) {
      for (const [framework, data] of Object.entries(complianceResults.frameworks)) {
        const score = data.score || 0;
        
        if (score < this.thresholds.complianceMin) {
          this.addFinding('HIGH', 'Compliance', `${framework} compliance score (${score}%) below threshold (${this.thresholds.complianceMin}%)`);
        } else {
          console.log(`✅ ${framework} compliance: ${score}%`);
        }
      }
    }
  }

  evaluateVulnerabilityThresholds(category, vulnerabilities) {
    const { critical, high, medium, low } = vulnerabilities;
    
    if (critical > this.thresholds.critical) {
      this.addFinding('CRITICAL', category, `${critical} critical vulnerabilities (threshold: ${this.thresholds.critical})`);
      this.passed = false;
    }
    
    if (high > this.thresholds.high) {
      this.addFinding('HIGH', category, `${high} high-severity vulnerabilities (threshold: ${this.thresholds.high})`);
      this.passed = false;
    }
    
    if (medium > this.thresholds.medium) {
      this.addFinding('MEDIUM', category, `${medium} medium-severity vulnerabilities (threshold: ${this.thresholds.medium})`);
    }
    
    if (low > this.thresholds.low) {
      this.addFinding('LOW', category, `${low} low-severity vulnerabilities (threshold: ${this.thresholds.low})`);
    }

    if (critical === 0 && high <= this.thresholds.high && medium <= this.thresholds.medium) {
      console.log(`✅ ${category}: Within acceptable thresholds`);
    }
  }

  calculateSecurityScore() {
    console.log('📊 Calculating security score...');
    
    let totalPoints = 100;
    
    // Deduct points for findings
    this.findings.forEach(finding => {
      switch (finding.severity) {
        case 'CRITICAL':
          totalPoints -= 25;
          break;
        case 'HIGH':
          totalPoints -= 10;
          break;
        case 'MEDIUM':
          totalPoints -= 5;
          break;
        case 'LOW':
          totalPoints -= 1;
          break;
      }
    });

    this.score = Math.max(0, totalPoints);
    console.log(`📊 Security Score: ${this.score}/100`);
  }

  addFinding(severity, category, description) {
    this.findings.push({
      severity,
      category,
      description,
      timestamp: new Date().toISOString()
    });
    
    const emoji = {
      'CRITICAL': '🚨',
      'HIGH': '⚠️',
      'MEDIUM': '⚡',
      'LOW': 'ℹ️'
    };
    
    console.log(`${emoji[severity]} ${severity}: ${category} - ${description}`);
  }

  generateReport() {
    console.log('\n📋 Generating security quality gate report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      passed: this.passed,
      score: this.score,
      thresholds: this.thresholds,
      findings: this.findings,
      summary: {
        totalFindings: this.findings.length,
        criticalFindings: this.findings.filter(f => f.severity === 'CRITICAL').length,
        highFindings: this.findings.filter(f => f.severity === 'HIGH').length,
        mediumFindings: this.findings.filter(f => f.severity === 'MEDIUM').length,
        lowFindings: this.findings.filter(f => f.severity === 'LOW').length
      },
      recommendations: this.generateRecommendations()
    };

    // Write report to file
    fs.writeFileSync('security-quality-gate-report.json', JSON.stringify(report, null, 2));
    
    // Generate human-readable summary
    this.generateSummary(report);
  }

  generateRecommendations() {
    const recommendations = [];
    
    const criticalFindings = this.findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = this.findings.filter(f => f.severity === 'HIGH');
    
    if (criticalFindings.length > 0) {
      recommendations.push('Immediately address all critical security findings before deployment');
      recommendations.push('Conduct emergency security review with security team');
    }
    
    if (highFindings.length > 0) {
      recommendations.push('Prioritize resolution of high-severity security findings');
      recommendations.push('Consider delaying deployment until high-severity issues are resolved');
    }
    
    if (this.score < 70) {
      recommendations.push('Overall security score is below acceptable threshold');
      recommendations.push('Comprehensive security review and remediation required');
    }
    
    if (this.findings.some(f => f.category.includes('Secrets'))) {
      recommendations.push('Rotate any exposed secrets immediately');
      recommendations.push('Review secret management practices');
    }
    
    if (this.findings.some(f => f.category.includes('Compliance'))) {
      recommendations.push('Address compliance gaps before production deployment');
      recommendations.push('Review compliance monitoring and controls');
    }
    
    return recommendations;
  }

  generateSummary(report) {
    const summaryLines = [
      '\n' + '='.repeat(60),
      '🔒 SECURITY QUALITY GATE SUMMARY',
      '='.repeat(60),
      `Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `Security Score: ${report.score}/100`,
      `Total Findings: ${report.summary.totalFindings}`,
      `  - Critical: ${report.summary.criticalFindings}`,
      `  - High: ${report.summary.highFindings}`,
      `  - Medium: ${report.summary.mediumFindings}`,
      `  - Low: ${report.summary.lowFindings}`,
      ''
    ];

    if (!report.passed) {
      summaryLines.push('🚨 DEPLOYMENT BLOCKED - Security quality gate failed!');
      summaryLines.push('');
      summaryLines.push('Critical Issues:');
      
      const criticalFindings = report.findings.filter(f => f.severity === 'CRITICAL');
      criticalFindings.forEach(finding => {
        summaryLines.push(`  - ${finding.category}: ${finding.description}`);
      });
      
      const highFindings = report.findings.filter(f => f.severity === 'HIGH');
      if (highFindings.length > 0) {
        summaryLines.push('');
        summaryLines.push('High Priority Issues:');
        highFindings.forEach(finding => {
          summaryLines.push(`  - ${finding.category}: ${finding.description}`);
        });
      }
    } else {
      summaryLines.push('✅ Security quality gate passed - Deployment approved');
    }

    if (report.recommendations.length > 0) {
      summaryLines.push('');
      summaryLines.push('Recommendations:');
      report.recommendations.forEach(rec => {
        summaryLines.push(`  - ${rec}`);
      });
    }

    summaryLines.push('');
    summaryLines.push('='.repeat(60));

    const summary = summaryLines.join('\n');
    console.log(summary);

    // Write summary to file
    fs.writeFileSync('security-quality-gate-summary.txt', summary);
  }

  determineGateStatus() {
    if (!this.passed) {
      console.log('\n❌ Security Quality Gate: FAILED');
      console.log('🚫 Deployment blocked due to security issues');
      
      // Create failure marker file
      fs.writeFileSync('security-gate-failed.txt', 
        `Security quality gate failed at ${new Date().toISOString()}\n` +
        `Score: ${this.score}/100\n` +
        `Critical findings: ${this.findings.filter(f => f.severity === 'CRITICAL').length}\n` +
        `High findings: ${this.findings.filter(f => f.severity === 'HIGH').length}`
      );
      
      process.exit(1);
    } else {
      console.log('\n✅ Security Quality Gate: PASSED');
      console.log('🚀 Deployment approved');
      
      // Remove any existing failure marker
      if (fs.existsSync('security-gate-failed.txt')) {
        fs.unlinkSync('security-gate-failed.txt');
      }
      
      process.exit(0);
    }
  }
}

// Main execution
async function main() {
  const gate = new SecurityQualityGate();
  await gate.evaluateSecurityResults();
}

// Handle command line execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Security quality gate evaluation failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityQualityGate;