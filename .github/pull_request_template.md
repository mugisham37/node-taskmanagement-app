# Pull Request

## Description

Brief description of the changes in this PR.

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Maintenance (dependency updates, code cleanup, etc.)
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix

## Related Issues

Closes #(issue number)
Relates to #(issue number)

## Changes Made

### Frontend Changes
- [ ] Web Application
- [ ] Admin Dashboard
- [ ] Mobile Application
- [ ] Shared UI Components

### Backend Changes
- [ ] API Endpoints
- [ ] Database Schema
- [ ] Business Logic
- [ ] Authentication/Authorization

### Infrastructure Changes
- [ ] Docker Configuration
- [ ] Kubernetes Manifests
- [ ] CI/CD Pipelines
- [ ] Monitoring/Observability

### Package Changes
- [ ] Core Package
- [ ] Domain Package
- [ ] Database Package
- [ ] Authentication Package
- [ ] Other: _______________

## Detailed Changes

### Added
- New feature A
- New endpoint B
- New component C

### Changed
- Modified behavior of X
- Updated styling for Y
- Improved performance of Z

### Removed
- Deprecated feature A
- Unused code B

### Fixed
- Bug in feature X
- Issue with component Y

## Testing

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

### Test Results
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] No regression in functionality
- [ ] Performance tests pass (if applicable)

### Manual Testing Checklist
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Tested on mobile devices
- [ ] Tested with different user roles
- [ ] Tested error scenarios

## Security Considerations

- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection maintained

## Performance Impact

- [ ] No performance degradation
- [ ] Performance improved
- [ ] Performance impact acceptable
- [ ] Performance testing completed

**Bundle Size Impact:**
- Web App: +/- X KB
- Admin App: +/- X KB
- Mobile App: +/- X KB

## Breaking Changes

If this PR introduces breaking changes, please describe:

1. **What breaks:** Description of what will no longer work
2. **Migration path:** How users can update their code
3. **Deprecation timeline:** When old functionality will be removed

## Database Changes

- [ ] No database changes
- [ ] Schema changes (migrations included)
- [ ] Data migrations required
- [ ] Seed data updated

**Migration Commands:**
```bash
# Commands to run for database updates
pnpm run db:migrate
```

## Documentation

- [ ] Code comments updated
- [ ] API documentation updated
- [ ] User documentation updated
- [ ] README updated
- [ ] Changelog updated

## Deployment Notes

### Environment Variables
- [ ] No new environment variables
- [ ] New environment variables added (documented in .env.example)
- [ ] Environment variables removed/changed

### Infrastructure Requirements
- [ ] No infrastructure changes required
- [ ] New services/dependencies required
- [ ] Configuration changes required

### Rollback Plan
Describe how to rollback this change if issues arise:

1. Revert the deployment
2. Run rollback migrations (if applicable)
3. Restore previous configuration

## Screenshots/Videos

If applicable, add screenshots or videos to demonstrate the changes:

### Before
[Screenshot/video of before state]

### After
[Screenshot/video of after state]

## Checklist

### Code Quality
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is properly commented
- [ ] No console.log or debug statements left
- [ ] Error handling implemented
- [ ] TypeScript types are correct

### Testing
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Manual testing completed
- [ ] Edge cases considered

### Documentation
- [ ] Documentation updated
- [ ] API changes documented
- [ ] Breaking changes documented

### Security & Performance
- [ ] Security implications considered
- [ ] Performance impact assessed
- [ ] Accessibility guidelines followed

### Review Ready
- [ ] PR is ready for review
- [ ] All CI checks pass
- [ ] Conflicts resolved
- [ ] Reviewers assigned

## Additional Notes

Add any additional notes, concerns, or context for reviewers here.

## Review Guidelines

**For Reviewers:**
1. Check code quality and adherence to standards
2. Verify test coverage and functionality
3. Review security implications
4. Assess performance impact
5. Ensure documentation is adequate
6. Test the changes locally if needed

**Approval Criteria:**
- [ ] Code quality meets standards
- [ ] Functionality works as expected
- [ ] Tests provide adequate coverage
- [ ] Security considerations addressed
- [ ] Documentation is complete