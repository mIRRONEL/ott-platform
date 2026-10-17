# Security Notes

## Accepted Advisories

### swagger-jsdoc -> glob -> minimatch (GHSA-3ppc-4f35-3m26)

- Date accepted: 2026-02-21
- Severity: High (ReDoS via repeated wildcards with non-matching literal in pattern)
- Affected services:
  - services/auth-service
  - services/notification-service
  - services/payment-service
  - services/analytics-service
- Rationale: swagger-jsdoc is required in production. The only available npm audit fix requires a breaking downgrade of swagger-jsdoc. No non-breaking upstream fix is currently available.
- Mitigations: Keep swagger endpoints protected or rate-limited; monitor upstream releases for a fix; reassess when swagger-jsdoc supports newer glob/minimatch.

