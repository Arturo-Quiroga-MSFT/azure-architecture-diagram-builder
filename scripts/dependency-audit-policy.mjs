const ENFORCED_SEVERITIES = new Set(['moderate', 'high', 'critical']);

function advisoryId(url) {
  return typeof url === 'string' ? url.match(/GHSA-[a-z0-9-]+/i)?.[0] : undefined;
}

export function validateExceptionPolicy(policy, now = new Date()) {
  const errors = [];
  const ids = new Set();
  for (const exception of policy?.exceptions || []) {
    if (!/^GHSA-[a-z0-9-]+$/i.test(exception.id || '')) errors.push('Exception has an invalid GHSA id');
    if (ids.has(exception.id)) errors.push(`Duplicate exception: ${exception.id}`);
    ids.add(exception.id);
    if (!exception.package) errors.push(`Exception ${exception.id} has no package`);
    if (!ENFORCED_SEVERITIES.has(exception.severity)) errors.push(`Exception ${exception.id} has invalid severity`);
    if (!exception.owner) errors.push(`Exception ${exception.id} has no owner`);
    if (!exception.reason) errors.push(`Exception ${exception.id} has no reason`);
    const expiry = new Date(`${exception.expires}T23:59:59Z`);
    if (!exception.expires || Number.isNaN(expiry.getTime())) errors.push(`Exception ${exception.id} has invalid expiry`);
    else if (now > expiry) errors.push(`Exception ${exception.id} expired on ${exception.expires}`);
  }
  return errors;
}

export function evaluateAudit(report, policy, { context, allowExceptions, now = new Date() }) {
  const errors = validateExceptionPolicy(policy, now);
  if (!report || report.error || !report.metadata?.vulnerabilities || !report.vulnerabilities) {
    return [...errors, `${context}: audit transport/tool failure`];
  }

  const exceptions = new Map((policy.exceptions || []).map(item => [item.id.toLowerCase(), item]));
  const wrappers = new Set(policy.allowedWrapperPackages || []);
  const allowedPackages = new Set([...new Set((policy.exceptions || []).map(item => item.package)), ...wrappers]);
  const seenExceptions = new Set();

  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!ENFORCED_SEVERITIES.has(vulnerability.severity)) continue;
    if (!allowExceptions) {
      errors.push(`${context}: ${packageName} has ${vulnerability.severity} severity`);
      continue;
    }
    if (!allowedPackages.has(packageName)) {
      errors.push(`${context}: non-allowlisted package ${packageName} has ${vulnerability.severity} severity`);
      continue;
    }
    if (vulnerability.severity === 'critical') {
      errors.push(`${context}: critical severity cannot be excepted for ${packageName}`);
    }
    for (const via of vulnerability.via || []) {
      if (typeof via === 'string') {
        if (!allowedPackages.has(via)) errors.push(`${context}: ${packageName} depends on non-allowlisted ${via}`);
        continue;
      }
      const id = advisoryId(via.url)?.toLowerCase();
      const exception = id ? exceptions.get(id) : undefined;
      if (!exception || exception.package !== packageName || exception.severity !== via.severity) {
        errors.push(`${context}: unapproved advisory ${id || via.source || 'unknown'} for ${packageName}`);
      } else {
        seenExceptions.add(exception.id.toLowerCase());
      }
    }
  }

  if (allowExceptions) {
    for (const id of exceptions.keys()) {
      if (!seenExceptions.has(id)) errors.push(`${context}: expected exception ${id} was not present in audit output`);
    }
  }
  return errors;
}
