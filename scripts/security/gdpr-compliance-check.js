#!/usr/bin/env node

/**
 * GDPR Compliance Check Script
 * Verifies GDPR compliance requirements across the application
 */

const fs = require('fs');
const path = require('path');

class GDPRComplianceChecker {
  constructor() {
    this.results = [];
    this.complianceScore = 0;
    this.requirements = [
      {
        id: 'gdpr_art_5',
        name: 'Principles of Processing Personal Data',
        description: 'Personal data must be processed lawfully, fairly and transparently',
        checks: [
          'data_encryption_check',
          'privacy_policy_check',
          'data_minimization_check',
          'purpose_limitation_check'
        ]
      },
      {
        id: 'gdpr_art_6',
        name: 'Lawfulness of Processing',
        description: 'Processing must have a lawful basis',
        checks: [
          'lawful_basis_documentation',
          'consent_management_check',
          'legitimate_interest_assessment'
        ]
      },
      {
        id: 'gdpr_art_7',
        name: 'Conditions for Consent',
        description: 'Consent must be freely given, specific, informed and unambiguous',
        checks: [
          'consent_mechanism_check',
          'consent_withdrawal_check',
          'consent_records_check'
        ]
      },
      {
        id: 'gdpr_art_12_14',
        name: 'Information and Access Rights',
        description: 'Individuals must be informed about data processing',
        checks: [
          'privacy_notice_check',
          'data_subject_rights_implementation',
          'information_transparency_check'
        ]
      },
      {
        id: 'gdpr_art_15',
        name: 'Right of Access',
        description: 'Individuals have the right to access their personal data',
        checks: [
          'data_access_mechanism',
          'data_portability_check',
          'response_time_compliance'
        ]
      },
      {
        id: 'gdpr_art_16',
        name: 'Right to Rectification',
        description: 'Individuals have the right to correct inaccurate personal data',
        checks: [
          'data_correction_mechanism',
          'rectification_notification_check'
        ]
      },
      {
        id: 'gdpr_art_17',
        name: 'Right to Erasure (Right to be Forgotten)',
        description: 'Individuals have the right to have their personal data erased',
        checks: [
          'data_deletion_mechanism',
          'erasure_verification_check',
          'third_party_notification_check'
        ]
      },
      {
        id: 'gdpr_art_20',
        name: 'Right to Data Portability',
        description: 'Individuals have the right to receive their data in a portable format',
        checks: [
          'data_export_mechanism',
          'structured_format_check',
          'machine_readable_format'
        ]
      },
      {
        id: 'gdpr_art_25',
        name: 'Data Protection by Design and by Default',
        description: 'Data protection must be built into systems from the start',
        checks: [
          'privacy_by_design_check',
          'default_privacy_settings',
          'data_minimization_implementation'
        ]
      },
      {
        id: 'gdpr_art_32',
        name: 'Security of Processing',
        description: 'Appropriate technical and organizational measures must be implemented',
        checks: [
          'encryption_implementation',
          'access_controls_check',
          'security_monitoring_check',
          'incident_response_procedures'
        ]
      },
      {
        id: 'gdpr_art_33_34',
        name: 'Personal Data Breach Notification',
        description: 'Data breaches must be reported within 72 hours',
        checks: [
          'breach_detection_mechanism',
          'breach_notification_procedures',
          'breach_documentation_check'
        ]
      },
      {
        id: 'gdpr_art_35',
        name: 'Data Protection Impact Assessment',
        description: 'DPIA required for high-risk processing',
        checks: [
          'dpia_process_check',
          'risk_assessment_documentation',
          'mitigation_measures_check'
        ]
      }
    ];
  }

  async runComplianceCheck() {
    console.log('🔒 Starting GDPR Compliance Check...\n');

    for (const requirement of this.requirements) {
      console.log(`📋 Checking: ${requirement.name}`);
      
      const requirementResult = {
        id: requirement.id,
        name: requirement.name,
        description: requirement.description,
        status: 'COMPLIANT',
        score: 100,
        findings: [],
        checks: []
      };

      for (const checkId of requirement.checks) {
        try {
          const checkResult = await this.runCheck(checkId);
          requirementResult.checks.push(checkResult);
          
          if (!checkResult.passed) {
            requirementResult.status = 'NON_COMPLIANT';
            requirementResult.findings.push(checkResult.finding);
          }
        } catch (error) {
          console.error(`❌ Error running check ${checkId}:`, error.message);
          requirementResult.checks.push({
            id: checkId,
            passed: false,
            finding: `Check failed: ${error.message}`,
            severity: 'HIGH'
          });
          requirementResult.status = 'NON_COMPLIANT';
        }
      }

      // Calculate requirement score
      const passedChecks = requirementResult.checks.filter(c => c.passed).length;
      const totalChecks = requirementResult.checks.length;
      requirementResult.score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

      this.results.push(requirementResult);
      
      const statusEmoji = requirementResult.status === 'COMPLIANT' ? '✅' : '❌';
      console.log(`${statusEmoji} ${requirement.name}: ${requirementResult.score}%\n`);
    }

    this.calculateOverallScore();
    this.generateReport();
  }

  async runCheck(checkId) {
    switch (checkId) {
      case 'data_encryption_check':
        return await this.checkDataEncryption();
      case 'privacy_policy_check':
        return await this.checkPrivacyPolicy();
      case 'data_minimization_check':
        return await this.checkDataMinimization();
      case 'purpose_limitation_check':
        return await this.checkPurposeLimitation();
      case 'lawful_basis_documentation':
        return await this.checkLawfulBasisDocumentation();
      case 'consent_management_check':
        return await this.checkConsentManagement();
      case 'legitimate_interest_assessment':
        return await this.checkLegitimateInterestAssessment();
      case 'consent_mechanism_check':
        return await this.checkConsentMechanism();
      case 'consent_withdrawal_check':
        return await this.checkConsentWithdrawal();
      case 'consent_records_check':
        return await this.checkConsentRecords();
      case 'privacy_notice_check':
        return await this.checkPrivacyNotice();
      case 'data_subject_rights_implementation':
        return await this.checkDataSubjectRights();
      case 'information_transparency_check':
        return await this.checkInformationTransparency();
      case 'data_access_mechanism':
        return await this.checkDataAccessMechanism();
      case 'data_portability_check':
        return await this.checkDataPortability();
      case 'response_time_compliance':
        return await this.checkResponseTimeCompliance();
      case 'data_correction_mechanism':
        return await this.checkDataCorrectionMechanism();
      case 'rectification_notification_check':
        return await this.checkRectificationNotification();
      case 'data_deletion_mechanism':
        return await this.checkDataDeletionMechanism();
      case 'erasure_verification_check':
        return await this.checkErasureVerification();
      case 'third_party_notification_check':
        return await this.checkThirdPartyNotification();
      case 'data_export_mechanism':
        return await this.checkDataExportMechanism();
      case 'structured_format_check':
        return await this.checkStructuredFormat();
      case 'machine_readable_format':
        return await this.checkMachineReadableFormat();
      case 'privacy_by_design_check':
        return await this.checkPrivacyByDesign();
      case 'default_privacy_settings':
        return await this.checkDefaultPrivacySettings();
      case 'data_minimization_implementation':
        return await this.checkDataMinimizationImplementation();
      case 'encryption_implementation':
        return await this.checkEncryptionImplementation();
      case 'access_controls_check':
        return await this.checkAccessControls();
      case 'security_monitoring_check':
        return await this.checkSecurityMonitoring();
      case 'incident_response_procedures':
        return await this.checkIncidentResponseProcedures();
      case 'breach_detection_mechanism':
        return await this.checkBreachDetectionMechanism();
      case 'breach_notification_procedures':
        return await this.checkBreachNotificationProcedures();
      case 'breach_documentation_check':
        return await this.checkBreachDocumentation();
      case 'dpia_process_check':
        return await this.checkDPIAProcess();
      case 'risk_assessment_documentation':
        return await this.checkRiskAssessmentDocumentation();
      case 'mitigation_measures_check':
        return await this.checkMitigationMeasures();
      default:
        throw new Error(`Unknown check: ${checkId}`);
    }
  }

  // Data Encryption Checks
  async checkDataEncryption() {
    const configFiles = [
      'packages/database/src/connection/database-config.ts',
      'packages/config/src/database/database.config.ts'
    ];

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('ssl: true') || content.includes('encrypt: true')) {
          return {
            id: 'data_encryption_check',
            passed: true,
            finding: 'Database encryption configured',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'data_encryption_check',
      passed: false,
      finding: 'Database encryption not properly configured',
      severity: 'HIGH'
    };
  }

  async checkPrivacyPolicy() {
    const policyFiles = [
      'docs/legal/privacy-policy.md',
      'apps/web/public/privacy-policy.html',
      'docs/user/privacy-policy.md'
    ];

    for (const file of policyFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const requiredSections = [
          'data collection',
          'data processing',
          'data retention',
          'user rights',
          'contact information'
        ];

        const foundSections = requiredSections.filter(section => 
          content.toLowerCase().includes(section)
        );

        if (foundSections.length >= 4) {
          return {
            id: 'privacy_policy_check',
            passed: true,
            finding: 'Privacy policy contains required sections',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'privacy_policy_check',
      passed: false,
      finding: 'Privacy policy missing or incomplete',
      severity: 'HIGH'
    };
  }

  async checkDataMinimization() {
    // Check database schema for minimal data collection
    const schemaFiles = [
      'packages/database/src/schema/users.ts',
      'packages/database/src/schema/tasks.ts'
    ];

    let hasExcessiveData = false;
    const excessiveFields = ['ssn', 'national_id', 'passport', 'drivers_license'];

    for (const file of schemaFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const field of excessiveFields) {
          if (content.includes(field)) {
            hasExcessiveData = true;
            break;
          }
        }
      }
    }

    return {
      id: 'data_minimization_check',
      passed: !hasExcessiveData,
      finding: hasExcessiveData ? 
        'Potentially excessive personal data fields detected' : 
        'Data collection appears minimal',
      severity: hasExcessiveData ? 'MEDIUM' : 'INFO'
    };
  }

  async checkPurposeLimitation() {
    // Check for data processing purpose documentation
    const purposeFiles = [
      'docs/legal/data-processing-purposes.md',
      'docs/architecture/data-usage.md'
    ];

    for (const file of purposeFiles) {
      if (fs.existsSync(file)) {
        return {
          id: 'purpose_limitation_check',
          passed: true,
          finding: 'Data processing purposes documented',
          severity: 'INFO'
        };
      }
    }

    return {
      id: 'purpose_limitation_check',
      passed: false,
      finding: 'Data processing purposes not documented',
      severity: 'MEDIUM'
    };
  }

  async checkConsentManagement() {
    // Check for consent management implementation
    const consentFiles = [
      'packages/auth/src/consent/consent-manager.ts',
      'apps/web/src/components/consent/ConsentBanner.tsx'
    ];

    for (const file of consentFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('consent') && content.includes('withdraw')) {
          return {
            id: 'consent_management_check',
            passed: true,
            finding: 'Consent management system implemented',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'consent_management_check',
      passed: false,
      finding: 'Consent management system not found',
      severity: 'HIGH'
    };
  }

  async checkDataDeletionMechanism() {
    // Check for data deletion implementation
    const deletionFiles = [
      'packages/domain/src/services/user-deletion.service.ts',
      'packages/database/src/repositories/user.repository.ts'
    ];

    for (const file of deletionFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('delete') || content.includes('remove')) {
          return {
            id: 'data_deletion_mechanism',
            passed: true,
            finding: 'Data deletion mechanism implemented',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'data_deletion_mechanism',
      passed: false,
      finding: 'Data deletion mechanism not implemented',
      severity: 'CRITICAL'
    };
  }

  async checkDataExportMechanism() {
    // Check for data export/portability implementation
    const exportFiles = [
      'packages/domain/src/services/data-export.service.ts',
      'apps/api/src/presentation/controllers/data-export.controller.ts'
    ];

    for (const file of exportFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('export') || content.includes('download')) {
          return {
            id: 'data_export_mechanism',
            passed: true,
            finding: 'Data export mechanism implemented',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'data_export_mechanism',
      passed: false,
      finding: 'Data export mechanism not implemented',
      severity: 'HIGH'
    };
  }

  async checkBreachNotificationProcedures() {
    // Check for breach notification procedures
    const breachFiles = [
      'docs/security/breach-response-plan.md',
      'packages/observability/src/security/incident-response.ts'
    ];

    for (const file of breachFiles) {
      if (fs.existsExists(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('breach') && content.includes('notification')) {
          return {
            id: 'breach_notification_procedures',
            passed: true,
            finding: 'Breach notification procedures documented',
            severity: 'INFO'
          };
        }
      }
    }

    return {
      id: 'breach_notification_procedures',
      passed: false,
      finding: 'Breach notification procedures not documented',
      severity: 'HIGH'
    };
  }

  // Placeholder implementations for remaining checks
  async checkLawfulBasisDocumentation() {
    return { id: 'lawful_basis_documentation', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkLegitimateInterestAssessment() {
    return { id: 'legitimate_interest_assessment', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkConsentMechanism() {
    return { id: 'consent_mechanism_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkConsentWithdrawal() {
    return { id: 'consent_withdrawal_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkConsentRecords() {
    return { id: 'consent_records_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkPrivacyNotice() {
    return { id: 'privacy_notice_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkDataSubjectRights() {
    return { id: 'data_subject_rights_implementation', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkInformationTransparency() {
    return { id: 'information_transparency_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkDataAccessMechanism() {
    return { id: 'data_access_mechanism', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkDataPortability() {
    return { id: 'data_portability_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkResponseTimeCompliance() {
    return { id: 'response_time_compliance', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkDataCorrectionMechanism() {
    return { id: 'data_correction_mechanism', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkRectificationNotification() {
    return { id: 'rectification_notification_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkErasureVerification() {
    return { id: 'erasure_verification_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkThirdPartyNotification() {
    return { id: 'third_party_notification_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkStructuredFormat() {
    return { id: 'structured_format_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkMachineReadableFormat() {
    return { id: 'machine_readable_format', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkPrivacyByDesign() {
    return { id: 'privacy_by_design_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkDefaultPrivacySettings() {
    return { id: 'default_privacy_settings', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkDataMinimizationImplementation() {
    return { id: 'data_minimization_implementation', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkEncryptionImplementation() {
    return { id: 'encryption_implementation', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkAccessControls() {
    return { id: 'access_controls_check', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkSecurityMonitoring() {
    return { id: 'security_monitoring_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkIncidentResponseProcedures() {
    return { id: 'incident_response_procedures', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkBreachDetectionMechanism() {
    return { id: 'breach_detection_mechanism', passed: false, finding: 'Not implemented', severity: 'HIGH' };
  }

  async checkBreachDocumentation() {
    return { id: 'breach_documentation_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkDPIAProcess() {
    return { id: 'dpia_process_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkRiskAssessmentDocumentation() {
    return { id: 'risk_assessment_documentation', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  async checkMitigationMeasures() {
    return { id: 'mitigation_measures_check', passed: false, finding: 'Not implemented', severity: 'MEDIUM' };
  }

  calculateOverallScore() {
    const totalRequirements = this.results.length;
    const totalScore = this.results.reduce((sum, result) => sum + result.score, 0);
    this.complianceScore = totalRequirements > 0 ? Math.round(totalScore / totalRequirements) : 0;
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 GDPR COMPLIANCE REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Compliance Score: ${this.complianceScore}%`);
    
    const compliantRequirements = this.results.filter(r => r.status === 'COMPLIANT').length;
    const nonCompliantRequirements = this.results.filter(r => r.status === 'NON_COMPLIANT').length;
    
    console.log(`Compliant Requirements: ${compliantRequirements}/${this.results.length}`);
    console.log(`Non-Compliant Requirements: ${nonCompliantRequirements}/${this.results.length}`);

    // Critical findings
    const criticalFindings = this.results.filter(r => 
      r.findings.some(f => f.includes('CRITICAL'))
    );

    if (criticalFindings.length > 0) {
      console.log('\n🚨 CRITICAL GDPR COMPLIANCE ISSUES:');
      criticalFindings.forEach(req => {
        console.log(`  - ${req.name}: ${req.findings.join(', ')}`);
      });
    }

    // High priority findings
    const highFindings = this.results.filter(r => 
      r.findings.some(f => f.includes('HIGH')) && 
      !r.findings.some(f => f.includes('CRITICAL'))
    );

    if (highFindings.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY GDPR ISSUES:');
      highFindings.forEach(req => {
        console.log(`  - ${req.name}: ${req.findings.join(', ')}`);
      });
    }

    // Recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    
    if (this.complianceScore < 70) {
      console.log('  - Comprehensive GDPR compliance review required');
      console.log('  - Consider engaging GDPR compliance consultant');
    }
    
    if (criticalFindings.length > 0) {
      console.log('  - Address critical compliance gaps immediately');
      console.log('  - Implement data subject rights mechanisms');
    }
    
    if (nonCompliantRequirements > compliantRequirements) {
      console.log('  - Prioritize implementation of missing GDPR controls');
      console.log('  - Establish regular compliance monitoring');
    }

    console.log('  - Document all data processing activities');
    console.log('  - Implement privacy by design principles');
    console.log('  - Conduct regular GDPR training for staff');
    console.log('  - Establish data breach response procedures');

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      overallScore: this.complianceScore,
      requirements: this.results,
      summary: {
        total: this.results.length,
        compliant: compliantRequirements,
        nonCompliant: nonCompliantRequirements,
        criticalIssues: criticalFindings.length,
        highPriorityIssues: highFindings.length
      }
    };

    fs.writeFileSync('gdpr-compliance-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: gdpr-compliance-report.json');
    console.log('='.repeat(60));
  }
}

// Main execution
async function main() {
  const checker = new GDPRComplianceChecker();
  await checker.runComplianceCheck();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ GDPR compliance check failed:', error);
    process.exit(1);
  });
}

module.exports = GDPRComplianceChecker;