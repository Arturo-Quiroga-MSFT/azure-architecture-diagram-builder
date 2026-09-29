import assert from 'node:assert/strict';
import { describeAzureSignInError } from '../src/utils/azureSignInErrors';

// MSAL surfaces Entra failures as errorCode + errorMessage carrying AADSTS codes.
const consent = describeAzureSignInError({
  errorCode: 'consent_required',
  errorMessage: 'AADSTS65001: The user or administrator has not consented to use the application.',
});
assert.equal(consent.kind, 'admin-consent');
assert.match(consent.message, /administrator to approve/);
assert.match(consent.message, /ARM template export/);

assert.equal(describeAzureSignInError(new Error('AADSTS90094: Admin approval required')).kind, 'admin-consent');
assert.equal(describeAzureSignInError({ errorCode: 'user_cancelled' }).kind, 'cancelled');
assert.equal(describeAzureSignInError({ errorMessage: 'AADSTS53003: Access has been blocked by Conditional Access policies.' }).kind, 'blocked');

// Unknown failures stay generic and never echo raw provider text back to the user.
const other = describeAzureSignInError(new Error('network down: token=secret'));
assert.equal(other.kind, 'other');
assert.doesNotMatch(other.message, /secret/);
assert.equal(describeAzureSignInError(undefined).kind, 'other');

console.log('Azure sign-in error mapping passed: consent, blocked, cancelled, generic');
