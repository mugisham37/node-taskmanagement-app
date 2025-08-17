#!/usr/bin/env node

/**
 * SOC 2 Controls Check Script
 * Verifies SOC 2 Type II compliance controls across the application
 */

const fs = require('fs');
const path = require('path');

class SOC2ControlsChecker {
  constructor() {
    this.results = [];
    this.complianceScore = 0;
    this.controls = [
      {
        id: 'CC1',
        name: 'Control Environment',
        description: 'The entity demonstrates a commitment to integrity and ethical values',
        subControls: [
          'CC1.1 - Integrity and Ethical Values',
          'CC1.2 - Board Independence and Oversight',
          'CC1.3 - Organizational Structure and Authority',
          'CC1.4 - Commitment to Competence',
          'CC1.5 - Accountability and Enforcement'
        ]
      },
      {
        id: 'CC2',
        name: 'Communication and Information',
        description: 'The entity obtains or generates and uses relevant, quality information',
        subControls: [
          'CC2.1 - Information Quality and Communication',
          'CC2.2 - Internal Communication',
          'CC2.3 - External Communication'
        ]
      },
      {
        id: 'CC3',
        name: 'Risk Assessment',
        description: 'The entity identifies, analyzes, and responds to risks',
        subControls: [
          'CC3.1 - Risk Identification and Assessment',
          'CC3.2 - Risk Response',
          'CC3.3 - Fraud Risk Assessment',
          'CC3.4 - Anti-Fraud Programs and Controls'
        ]
      },
      {
        id: 'CC4',
        name: 'Monitoring Activities',
        description: 'The entity monitors the system and evaluates results',
        subControls: [
          'CC4.1 - Monitoring Activities and Evaluation',
          'CC4.2 - Communication of Deficiencies'
        ]
      },
      {
        id: 'CC5',
        name: 'Control Activities',
        description: 'The entity implements control activities',
        subControls: [
          'CC5.1 - Control Activities Design and Implementation',
          'CC5.2 - Technology General Controls',
          'CC5.3 - Outsourced Service Provider Controls'
        ]
      },
      {
        id: 'CC6',
        name: 'Logical and Physical Access Controls',
        description: 'The entity implements logical and physical access controls',
        subControls: [
          'CC6.1 - Logical Access Controls',
          'CC6.2 - Authentication and Authorization',
          'CC6.3 - Network Security',
          'CC6.4 - Data Classification',
          'CC6.5 - System Boundaries',
          'CC6.6 - Transmission of Data',
          'CC6.7 - Data Loss Prevention',
          'CC6.8 - Physical Access Controls'
        ]
      },
      {
        id: 'CC7',
        name: 'System Operations',
        description: 'The entity manages system operations',
        subControls: [
          'CC7.1 - System Operations Management',
          'CC7.2 - Change Management',
          'CC7.3 - Job Scheduling and Batch Processing',
          'CC7.4 - System Backup and Recovery',
          'CC7.5 - System Capacity and Performance'
        ]
      },
      {
        id: 'CC8',
        name: 'Change Management',
        description: 'The entity implements change management processes',
        subControls: [
          'CC8.1 - Change Management Process',
          'CC8.2 - Change Authorization and Approval',
          'CC8.3 - System Development Life Cycle'
        ]
      },
      {
        id: 'CC9',
        name: 'Risk Mitigation',
        description: 'The entity implements risk mitigation activities',
        subControls: [
          'CC9.1 - Risk Mitigation Policies and Procedures',
          'CC9.2 - Vendor and Third Party Management'
        ]
      },
      // Additional criteria for Security, Availability, Processing Integrity, Confidentiality, Privacy
      {
        id: 'A1',
        name: 'Availability - System Availability',
        description: 'The entity maintains system availability commitments',
        subControls: [
          'A1.1 - Availability Commitments',
          'A1.2 - System Monitoring',
          'A1.3 - Incident Response'
        ]
      },
      {
        id: 'PI1',
        name: 'Processing Integrity - Data Processing',
        description: 'The entity processes data with integrity',
        subControls: [
          'PI1.1 - Data Processing Integrity',
          'PI1.2 - Data Input Controls',
          'PI1.3 - Data Processing Controls'
        ]
      },
      {
        id: 'C1',
        name: 'Confidentiality - Data Protection',
        description: 'The entity protects confidential information',
        subControls: [
          'C1.1 - Confidentiality Commitments',
          'C1.2 - Data Classification and Handling'
        ]
      },
      {
        id: 'P1',
        name: 'Privacy - Personal Information',
        description: 'The entity protects personal information',
        subControls: [
          'P1.1 - Privacy Commitments',
          'P1.2 - Personal Information Collection',
          'P1.3 - Personal Information Use and Retention',
          'P1.4 - Personal Information Access',
          'P1.5 - Personal Information Disclosure'
        ]
      }
    ];
  }

  async runControlsCheck() {
    console.log('🔒 Starting SOC 2 Controls Check...\n');

    for (const control of this.controls) {
      console.log(`📋 Checking: ${control.id} - ${control.name}`);
      
      const controlResult = {
        id: control.id,
        name: control.name,
        description: control.description,
        status: 'COMPLIANT',
        score: 100,
        findings: [],
        subControlResults: []
      };

      // Check each sub-control
      for (const subControl of control.subControls) {
        try {
          const subControlResult = await this.checkSubControl(control.id, subControl);
          controlResult.subControlResults.push(subControlResult);
          
          if (!subControlResult.passed) {
            controlResult.status = 'NON_COMPLIANT';
            controlResult.findings.push(subControlResult.finding);
          }
        } catch (error) {
          console.error(`❌ Error checking ${subControl}:`, error.message);
          controlResult.subControlResults.push({
            id: subControl,
            passed: false,
            finding: `Check failed: ${error.message}`,
            severity: 'HIGH'
          });
          controlResult.status = 'NON_COMPLIANT';
        }
      }

      // Calculate control score
      const passedSubControls = controlResult.subControlResults.filter(sc => sc.passed).length;
      const totalSubControls = controlResult.subControlResults.length;
      controlResult.score = totalSubControls > 0 ? Math.round((passedSubControls / totalSubControls) * 100) : 0;

      this.results.push(controlResult);
      
      const statusEmoji = controlResult.status === 'COMPLIANT' ? '✅' : '❌';
      console.log(`${statusEmoji} ${control.id}: ${controlResult.score}%\n`);
    }

    this.calculateOverallScore();
    this.generateReport();
  }

  async checkSubControl(controlId, subControl) {
    const subControlId = subControl.split(' - ')[0];
    
    switch (subControlId) {
      // CC6 - Logical and Physical Access Controls
      case 'CC6.1':
        return await this.checkLogicalAccessControls();
      case 'CC6.2':
        return await this.checkAuthenticationAuthorization();
      case 'CC6.3':
        return await this.checkNetworkSecurity();
      case 'CC6.4':
        return await this.checkDataClassification();
      case 'CC6.6':
        return await this.checkDataTransmission();
      case 'CC6.7':
        return await this.checkDataLossPrevention();
      
      // CC7 - System Operations
      case 'CC7.1':
        return await this.checkSystemOperations();
      case 'CC7.2':
        return await this.checkChangeManagement();
      case 'CC7.4':
        return await this.checkBackupRecovery();
      case 'CC7.5':
        return await this.checkCapacityPerformance();
      
      // CC8 - Change Management
      case 'CC8.1':
        return await this.checkChangeProcess();
      case 'CC8.2':
        return await this.checkChangeAuthorization();
      case 'CC8.3':
        return await this.checkSDLC();
      
      // A1 - Availability
      case 'A1.1':
        return await this.checkAvailabilityCommitments();
      case 'A1.2':
        return await this.checkSystemMonitoring();
      case 'A1.3':
        return await this.checkIncidentResponse();
      
      // PI1 - Processing Integrity
      case 'PI1.1':
        return await this.checkProcessingIntegrity();
      case 'PI1.2':
        return await this.checkDataInputControls();
      case 'PI1.3':
        return await this.checkDataProcessingControls();
      
      // C1 - Confidentiality
      case 'C1.1':
        return await this.checkConfidentialityCommitments();
      case 'C1.2':
        return await this.checkDataHandling();
      
      // P1 - Privacy
      case 'P1.1':
        return await this.checkPrivacyCommitments();
      case 'P1.2':
        return await this.checkPersonalInfoCollection();
      case 'P1.3':
        return await this.checkPersonalInfoUse();
      case 'P1.4':
        return await this.checkPersonalInfoAccess();
      case 'P1.5':
        return await this.checkPersonalInfoDisclosure();
      
      default:
        return {
          id: subControlId,
          passed: false,
          finding: 'Control check not implemented',
          severity: 'MEDIUM'
        };
    }
  }

  // CC6 - Access Controls Implementation
  async checkLogicalAccessControls() {
    const authFiles = [
      'packages/auth/src/guards/auth.guard.ts',
      'packages/auth/src/middleware/auth.middleware.ts'
    ];

    for (const file of authFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('authenticate') && content.includes('authorize')) {
          return {
            id: 'CC6.1',
            passed: true,
            finding: 'Logical access controls implemented',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'CC6.1',
      passed: false,
      finding: 'Logical access controls not properly implemented',
      severity: 'HIGH'
    };
  }

  async checkAuthenticationAuthorization() {
    const authFiles = [
      'packages/auth/src/strategies/jwt.strategy.ts',
      'packages/auth/src/rbac/rbac.service.ts'
    ];

    let hasAuth = false;
    let hasRBAC = false;

    for (const file of authFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('jwt') || content.includes('token')) {
          hasAuth = true;
        }
        if (content.includes('role') || content.includes('permission')) {
          hasRBAC = true;
        }
      }
    }

    if (hasAuth && hasRBAC) {
      return {
        id: 'CC6.2',
        passed: true,
        finding: 'Authentication and authorization mechanisms implemented',
        severity: 'INFO'
      };
    }

    return {
      id: 'CC6.2',
      passed: false,
      finding: 'Authentication and authorization mechanisms incomplete',
      severity: 'CRITICAL'
    };
  }

  async checkNetworkSecurity() {
    // Check for network security configurations
    const securityFiles = [
      'infrastructure/kubernetes/network-policies.yaml',
      'infrastructure/terraform/security-groups.tf'
    ];

    for (const file of securityFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC6.3',
          passed: true,
          finding: 'Network security controls configured',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC6.3',
      passed: false,
      finding: 'Network security controls not configured',
      severity: 'HIGH'
    };
  }

  async checkDataClassification() {
    // Check for data classification implementation
    const classificationFiles = [
      'packages/domain/src/entities/data-classification.ts',
      'docs/security/data-classification-policy.md'
    ];

    for (const file of classificationFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC6.4',
          passed: true,
          finding: 'Data classification system implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC6.4',
      passed: false,
      finding: 'Data classification system not implemented',
      severity: 'MEDIUM'
    };
  }

  async checkDataTransmission() {
    // Check for secure data transmission
    const configFiles = [
      'apps/api/src/main.ts',
      'infrastructure/kubernetes/ingress.yaml'
    ];

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('https') || content.includes('tls') || content.includes('ssl')) {
          return {
            id: 'CC6.6',
            passed: true,
            finding: 'Secure data transmission configured',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'CC6.6',
      passed: false,
      finding: 'Secure data transmission not properly configured',
      severity: 'HIGH'
    };
  }

  async checkDataLossPrevention() {
    // Check for data loss prevention measures
    const dlpFiles = [
      'packages/observability/src/security/data-loss-prevention.ts',
      'packages/auth/src/guards/data-access.guard.ts'
    ];

    for (const file of dlpFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC6.7',
          passed: true,
          finding: 'Data loss prevention measures implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC6.7',
      passed: false,
      finding: 'Data loss prevention measures not implemented',
      severity: 'MEDIUM'
    };
  }

  // CC7 - System Operations
  async checkSystemOperations() {
    // Check for system operations monitoring
    const opsFiles = [
      'monitoring/prometheus/prometheus.yml',
      'monitoring/grafana/dashboards/'
    ];

    for (const file of opsFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC7.1',
          passed: true,
          finding: 'System operations monitoring implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC7.1',
      passed: false,
      finding: 'System operations monitoring not implemented',
      severity: 'MEDIUM'
    };
  }

  async checkChangeManagement() {
    // Check for change management processes
    const changeFiles = [
      '.github/workflows/ci.yml',
      'docs/development/change-management.md'
    ];

    for (const file of changeFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC7.2',
          passed: true,
          finding: 'Change management processes implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC7.2',
      passed: false,
      finding: 'Change management processes not documented',
      severity: 'MEDIUM'
    };
  }

  async checkBackupRecovery() {
    // Check for backup and recovery procedures
    const backupFiles = [
      'scripts/backup/database-backup.sh',
      'infrastructure/terraform/backup.tf'
    ];

    for (const file of backupFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC7.4',
          passed: true,
          finding: 'Backup and recovery procedures implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC7.4',
      passed: false,
      finding: 'Backup and recovery procedures not implemented',
      severity: 'HIGH'
    };
  }

  async checkCapacityPerformance() {
    // Check for capacity and performance monitoring
    const perfFiles = [
      'monitoring/grafana/dashboards/performance.json',
      'tests/performance/'
    ];

    for (const file of perfFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'CC7.5',
          passed: true,
          finding: 'Capacity and performance monitoring implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'CC7.5',
      passed: false,
      finding: 'Capacity and performance monitoring not implemented',
      severity: 'MEDIUM'
    };
  }

  // Availability Controls
  async checkAvailabilityCommitments() {
    // Check for availability commitments documentation
    const availabilityFiles = [
      'docs/sla/availability-commitments.md',
      'docs/architecture/high-availability.md'
    ];

    for (const file of availabilityFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'A1.1',
          passed: true,
          finding: 'Availability commitments documented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'A1.1',
      passed: false,
      finding: 'Availability commitments not documented',
      severity: 'MEDIUM'
    };
  }

  async checkSystemMonitoring() {
    // Check for comprehensive system monitoring
    const monitoringFiles = [
      'monitoring/prometheus/rules/',
      'monitoring/alertmanager/config.yml'
    ];

    for (const file of monitoringFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'A1.2',
          passed: true,
          finding: 'System monitoring implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'A1.2',
      passed: false,
      finding: 'System monitoring not properly implemented',
      severity: 'HIGH'
    };
  }

  async checkIncidentResponse() {
    // Check for incident response procedures
    const incidentFiles = [
      'packages/observability/src/security/incident-response.ts',
      'docs/security/incident-response-plan.md'
    ];

    for (const file of incidentFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'A1.3',
          passed: true,
          finding: 'Incident response procedures implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'A1.3',
      passed: false,
      finding: 'Incident response procedures not implemented',
      severity: 'HIGH'
    };
  }

  // Processing Integrity Controls
  async checkProcessingIntegrity() {
    // Check for data processing integrity controls
    const integrityFiles = [
      'packages/validation/src/schemas/',
      'packages/domain/src/services/data-validation.service.ts'
    ];

    for (const file of integrityFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'PI1.1',
          passed: true,
          finding: 'Data processing integrity controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'PI1.1',
      passed: false,
      finding: 'Data processing integrity controls not implemented',
      severity: 'HIGH'
    };
  }

  async checkDataInputControls() {
    // Check for data input validation controls
    const inputFiles = [
      'packages/validation/src/guards/',
      'apps/api/src/presentation/middleware/validation.middleware.ts'
    ];

    for (const file of inputFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'PI1.2',
          passed: true,
          finding: 'Data input controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'PI1.2',
      passed: false,
      finding: 'Data input controls not implemented',
      severity: 'HIGH'
    };
  }

  async checkDataProcessingControls() {
    // Check for data processing controls
    const processingFiles = [
      'packages/domain/src/services/',
      'packages/events/src/handlers/'
    ];

    for (const file of processingFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'PI1.3',
          passed: true,
          finding: 'Data processing controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'PI1.3',
      passed: false,
      finding: 'Data processing controls not implemented',
      severity: 'MEDIUM'
    };
  }

  // Confidentiality Controls
  async checkConfidentialityCommitments() {
    // Check for confidentiality commitments
    const confidentialityFiles = [
      'docs/security/confidentiality-policy.md',
      'docs/legal/nda-template.md'
    ];

    for (const file of confidentialityFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'C1.1',
          passed: true,
          finding: 'Confidentiality commitments documented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'C1.1',
      passed: false,
      finding: 'Confidentiality commitments not documented',
      severity: 'MEDIUM'
    };
  }

  async checkDataHandling() {
    // Check for data handling procedures
    const handlingFiles = [
      'packages/domain/src/services/data-encryption.service.ts',
      'docs/security/data-handling-procedures.md'
    ];

    for (const file of handlingFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'C1.2',
          passed: true,
          finding: 'Data handling procedures implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'C1.2',
      passed: false,
      finding: 'Data handling procedures not implemented',
      severity: 'HIGH'
    };
  }

  // Privacy Controls
  async checkPrivacyCommitments() {
    // Check for privacy commitments
    const privacyFiles = [
      'docs/legal/privacy-policy.md',
      'docs/legal/privacy-commitments.md'
    ];

    for (const file of privacyFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'P1.1',
          passed: true,
          finding: 'Privacy commitments documented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'P1.1',
      passed: false,
      finding: 'Privacy commitments not documented',
      severity: 'HIGH'
    };
  }

  async checkPersonalInfoCollection() {
    // Check for personal information collection controls
    const collectionFiles = [
      'packages/domain/src/services/data-collection.service.ts',
      'packages/validation/src/schemas/personal-data.schema.ts'
    ];

    for (const file of collectionFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'P1.2',
          passed: true,
          finding: 'Personal information collection controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'P1.2',
      passed: false,
      finding: 'Personal information collection controls not implemented',
      severity: 'HIGH'
    };
  }

  async checkPersonalInfoUse() {
    // Check for personal information use and retention controls
    const useFiles = [
      'packages/domain/src/services/data-retention.service.ts',
      'docs/legal/data-retention-policy.md'
    ];

    for (const file of useFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'P1.3',
          passed: true,
          finding: 'Personal information use and retention controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'P1.3',
      passed: false,
      finding: 'Personal information use and retention controls not implemented',
      severity: 'HIGH'
    };
  }

  async checkPersonalInfoAccess() {
    // Check for personal information access controls
    const accessFiles = [
      'packages/domain/src/services/data-access.service.ts',
      'packages/auth/src/guards/data-access.guard.ts'
    ];

    for (const file of accessFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'P1.4',
          passed: true,
          finding: 'Personal information access controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'P1.4',
      passed: false,
      finding: 'Personal information access controls not implemented',
      severity: 'HIGH'
    };
  }

  async checkPersonalInfoDisclosure() {
    // Check for personal information disclosure controls
    const disclosureFiles = [
      'packages/domain/src/services/data-sharing.service.ts',
      'docs/legal/data-sharing-agreements.md'
    ];

    for (const file of disclosureFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'P1.5',
          passed: true,
          finding: 'Personal information disclosure controls implemented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'P1.5',
      passed: false,
      finding: 'Personal information disclosure controls not implemented',
      severity: 'HIGH'
    };
  }

  // Placeholder implementations for remaining controls
  async checkChangeProcess() {
    return { id: 'CC8.1', passed: false, finding: 'Change process not documented', severity: 'MEDIUM' };
  }

  async checkChangeAuthorization() {
    return { id: 'CC8.2', passed: false, finding: 'Change authorization not implemented', severity: 'MEDIUM' };
  }

  async checkSDLC() {
    return { id: 'CC8.3', passed: false, finding: 'SDLC not documented', severity: 'MEDIUM' };
  }

  calculateOverallScore() {
    const totalControls = this.results.length;
    const totalScore = this.results.reduce((sum, result) => sum + result.score, 0);
    this.complianceScore = totalControls > 0 ? Math.round(totalScore / totalControls) : 0;
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 SOC 2 CONTROLS COMPLIANCE REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Compliance Score: ${this.complianceScore}%`);
    
    const compliantControls = this.results.filter(r => r.status === 'COMPLIANT').length;
    const nonCompliantControls = this.results.filter(r => r.status === 'NON_COMPLIANT').length;
    
    console.log(`Compliant Controls: ${compliantControls}/${this.results.length}`);
    console.log(`Non-Compliant Controls: ${nonCompliantControls}/${this.results.length}`);

    // Critical findings
    const criticalFindings = this.results.filter(r => 
      r.findings.some(f => f.includes('CRITICAL'))
    );

    if (criticalFindings.length > 0) {
      console.log('\n🚨 CRITICAL SOC 2 COMPLIANCE ISSUES:');
      criticalFindings.forEach(control => {
        console.log(`  - ${control.id} ${control.name}: ${control.findings.join(', ')}`);
      });
    }

    // High priority findings
    const highFindings = this.results.filter(r => 
      r.findings.some(f => f.includes('HIGH')) && 
      !r.findings.some(f => f.includes('CRITICAL'))
    );

    if (highFindings.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY SOC 2 ISSUES:');
      highFindings.forEach(control => {
        console.log(`  - ${control.id} ${control.name}: ${control.findings.join(', ')}`);
      });
    }

    // Recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    
    if (this.complianceScore < 80) {
      console.log('  - Comprehensive SOC 2 compliance review required');
      console.log('  - Consider engaging SOC 2 compliance consultant');
    }
    
    if (criticalFindings.length > 0) {
      console.log('  - Address critical control gaps immediately');
      console.log('  - Implement missing authentication and authorization controls');
    }
    
    if (nonCompliantControls > compliantControls) {
      console.log('  - Prioritize implementation of missing SOC 2 controls');
      console.log('  - Establish regular compliance monitoring');
    }

    console.log('  - Document all security policies and procedures');
    console.log('  - Implement comprehensive access controls');
    console.log('  - Establish incident response procedures');
    console.log('  - Conduct regular security training');
    console.log('  - Implement continuous monitoring and alerting');

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      overallScore: this.complianceScore,
      controls: this.results,
      summary: {
        total: this.results.length,
        compliant: compliantControls,
        nonCompliant: nonCompliantControls,
        criticalIssues: criticalFindings.length,
        highPriorityIssues: highFindings.length
      }
    };

    fs.writeFileSync('soc2-controls-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: soc2-controls-report.json');
    console.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const checker = new SOC2ControlsChecker();
  await checker.runControlsCheck();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ SOC 2 controls check failed:', error);
    process.exit(1);
  });
}

module.exports = SOC2ControlsChecker;