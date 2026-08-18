// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Send, X } from 'lucide-react';
import {
  ARTIFACT_TYPES,
  DEPLOYMENT_MODES,
  ENGAGEMENT_STAGES,
  EXTERNAL_USE_TYPES,
  HOSTING_MODES,
  IMPACT_ROLES,
  ORGANIZATION_TYPES,
  OUTCOME_TYPES,
  REGISTRATION_ENVIRONMENTS,
  TIME_SAVED_BANDS,
  USAGE_SCENARIOS,
  clearAdoptionProfile,
  getAdoptionProfile,
  getInstallationId,
  saveAdoptionProfile,
  submitDeploymentRegistration,
  submitImpactStory,
  type AdoptionProfile,
  type ArtifactType,
  type DeploymentRegistrationInput,
  type EngagementStage,
  type ExternalUseType,
  type HostingMode,
  type ImpactRole,
  type OrganizationType,
  type OutcomeType,
  type RegistrationEnvironment,
  type TimeSavedBand,
  type UsageScenario,
  type DeploymentMode,
} from '../services/impactService';
import { trackAdoptionProfileSaved, trackDeploymentRegistered, trackImpactStorySubmitted } from '../services/impactTelemetryService';
import './ImpactModal.css';

interface ImpactModalProps { isOpen: boolean; onClose: () => void; }
type Tab = 'profile' | 'story' | 'deployment';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labelOverrides: Record<string, string> = {
  'mcp-agent-workflow': 'MCP / agent workflow',
  'bicep-terraform': 'Bicep / Terraform',
  '1-4-hours': '1-4 hours',
};
const label = (value: string) => labelOverrides[value] || value.split('-').map((part) => part === 'psa' || part === 'csa' ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

const defaultProfile: AdoptionProfile = {
  organizationType: 'prefer-not-to-say', role: 'prefer-not-to-say', usageScenario: 'personal-evaluation', deploymentMode: 'public-hosted',
};

export default function ImpactModal({ isOpen, onClose }: ImpactModalProps) {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<AdoptionProfile>(defaultProfile);
  const [submitted, setSubmitted] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [audience, setAudience] = useState<OrganizationType>('prefer-not-to-say');
  const [engagementStage, setEngagementStage] = useState<EngagementStage>('evaluation');
  const [outcome, setOutcome] = useState<OutcomeType>('time-saved');
  const [timeSaved, setTimeSaved] = useState<TimeSavedBand>('unknown');
  const [artifacts, setArtifacts] = useState<ArtifactType[]>(['diagram']);
  const [externalUse, setExternalUse] = useState<ExternalUseType>('none');
  const [narrative, setNarrative] = useState('');
  const [internalSharingConsent, setInternalSharingConsent] = useState(false);
  const [nameConsent, setNameConsent] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [contactEmail, setContactEmail] = useState('');

  const [environmentType, setEnvironmentType] = useState<RegistrationEnvironment>('community');
  const [hosting, setHosting] = useState<HostingMode>('container-apps');
  const [region, setRegion] = useState('');
  const [customerDeployment, setCustomerDeployment] = useState(false);
  const [registrationNameConsent, setRegistrationNameConsent] = useState(false);
  const [registrationOrganization, setRegistrationOrganization] = useState('');
  const [registrationContactConsent, setRegistrationContactConsent] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');

  useEffect(() => {
    if (isOpen) setProfile(getAdoptionProfile() || defaultProfile);
  }, [isOpen]);

  if (!isOpen) return null;

  const resetMessage = () => { setSubmitted(''); setError(''); };
  const close = () => { resetMessage(); onClose(); };
  const validContact = (consent: boolean, email: string) => !consent || (email.length <= 254 && emailPattern.test(email.trim()));

  const saveProfile = () => {
    saveAdoptionProfile(profile);
    trackAdoptionProfileSaved(profile);
    setSubmitted('Your optional context was saved in this browser. You can clear it at any time.');
  };

  const submitStory = async () => {
    if (artifacts.length === 0) return setError('Select at least one artifact used.');
    if (!validContact(contactConsent, contactEmail)) return setError('Enter a valid email when follow-up is enabled.');
    if (nameConsent && !organizationName.trim()) return setError('Enter the organization/customer name or turn off naming consent.');
    setBusy(true); setError('');
    const input = {
      audience, engagementStage, outcome, timeSaved, artifacts, externalUse, narrative: narrative.trim(),
      internalSharingConsent, nameConsent, organizationName: organizationName.trim(), contactConsent, contactEmail: contactEmail.trim(),
    };
    const persisted = await submitImpactStory(input);
    trackImpactStorySubmitted(input, persisted);
    setBusy(false);
    setSubmitted(persisted ? 'Your self-reported outcome was saved. Thank you.' : 'The outcome summary was measured, but the detailed story could not be saved.');
  };

  const submitRegistration = async () => {
    if (!validContact(registrationContactConsent, registrationEmail)) return setError('Enter a valid email when follow-up is enabled.');
    if (registrationNameConsent && !registrationOrganization.trim()) return setError('Enter the organization name or turn off naming consent.');
    setBusy(true); setError('');
    const input: DeploymentRegistrationInput = {
      installationId: getInstallationId(), environmentType, hosting, region: region.trim(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'development', customerDeployment,
      nameConsent: registrationNameConsent, organizationName: registrationOrganization.trim(),
      contactConsent: registrationContactConsent, contactEmail: registrationEmail.trim(),
    };
    const persisted = await submitDeploymentRegistration(input);
    trackDeploymentRegistered(input, persisted);
    setBusy(false);
    setSubmitted(persisted ? 'This installation was registered with a random installation ID.' : 'The registration summary was measured, but the durable registration could not be saved.');
  };

  const toggleArtifact = (artifact: ArtifactType) => setArtifacts((current) => current.includes(artifact) ? current.filter((item) => item !== artifact) : [...current, artifact]);

  return <div className="modal-overlay" onClick={close}>
    <div className="modal-content impact-modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><h2><BarChart3 size={23} /> Adoption &amp; Impact</h2><button className="modal-close" onClick={close} title="Close"><X size={22} /></button></div>
      <div className="impact-tabs" role="tablist">
        {([['profile', 'Your context'], ['story', 'Share an outcome'], ['deployment', 'Register deployment']] as const).map(([id, text]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); resetMessage(); }}>{text}</button>)}
      </div>
      {submitted ? <div className="impact-status"><CheckCircle2 size={44} /><h3>Recorded</h3><p>{submitted}</p><button className="btn-primary" onClick={() => setSubmitted('')}>Continue</button></div> : <>
        <div className="modal-body">
          {tab === 'profile' && <ProfileForm profile={profile} setProfile={setProfile} />}
          {tab === 'story' && <div className="impact-grid">
            <SelectField id="impact-audience" labelText="Audience involved" value={audience} values={ORGANIZATION_TYPES} onChange={(value) => setAudience(value as OrganizationType)} />
            <SelectField id="impact-stage" labelText="Engagement stage" value={engagementStage} values={ENGAGEMENT_STAGES} onChange={(value) => setEngagementStage(value as EngagementStage)} />
            <SelectField id="impact-outcome" labelText="Primary outcome" value={outcome} values={OUTCOME_TYPES} onChange={(value) => setOutcome(value as OutcomeType)} />
            <SelectField id="impact-time" labelText="Estimated time saved" value={timeSaved} values={TIME_SAVED_BANDS} onChange={(value) => setTimeSaved(value as TimeSavedBand)} />
            <SelectField id="impact-external" labelText="External use" value={externalUse} values={EXTERNAL_USE_TYPES} onChange={(value) => setExternalUse(value as ExternalUseType)} />
            <div className="form-group full-width"><label>Artifacts used</label><div className="impact-checks">{ARTIFACT_TYPES.map((artifact) => <label key={artifact}><input type="checkbox" checked={artifacts.includes(artifact)} onChange={() => toggleArtifact(artifact)} />{label(artifact)}</label>)}</div></div>
            <div className="form-group full-width"><label htmlFor="impact-narrative">What changed? (optional)</label><textarea id="impact-narrative" rows={3} maxLength={2000} value={narrative} onChange={(event) => setNarrative(event.target.value)} /></div>
            <ConsentFields nameConsent={nameConsent} setNameConsent={setNameConsent} organizationName={organizationName} setOrganizationName={setOrganizationName} contactConsent={contactConsent} setContactConsent={setContactConsent} email={contactEmail} setEmail={setContactEmail} internalConsent={internalSharingConsent} setInternalConsent={setInternalSharingConsent} />
          </div>}
          {tab === 'deployment' && <div className="impact-grid">
            <SelectField id="registration-environment" labelText="Deployment environment" value={environmentType} values={REGISTRATION_ENVIRONMENTS} onChange={(value) => setEnvironmentType(value as RegistrationEnvironment)} />
            <SelectField id="registration-hosting" labelText="Hosting" value={hosting} values={HOSTING_MODES} onChange={(value) => setHosting(value as HostingMode)} />
            <div className="form-group"><label htmlFor="registration-region">Azure region (optional)</label><input id="registration-region" type="text" maxLength={80} value={region} onChange={(event) => setRegion(event.target.value)} placeholder="e.g., canadacentral" /></div>
            <label className="impact-consent"><input type="checkbox" checked={customerDeployment} onChange={(event) => setCustomerDeployment(event.target.checked)} />This is deployed for a customer</label>
            <ConsentFields nameConsent={registrationNameConsent} setNameConsent={setRegistrationNameConsent} organizationName={registrationOrganization} setOrganizationName={setRegistrationOrganization} contactConsent={registrationContactConsent} setContactConsent={setRegistrationContactConsent} email={registrationEmail} setEmail={setRegistrationEmail} />
          </div>}
          {error && <div className="feedback-error">{error}</div>}
          <p className="impact-note">Optional and privacy-conscious: categorical summaries go to product analytics. Narrative, organization name, and email go only to Cosmos when the relevant consent is enabled. Never include tenant IDs, subscription IDs, prompts, diagrams, or secrets.</p>
        </div>
        <div className="modal-actions">
          {tab === 'profile' && <button className="btn-secondary" onClick={() => { clearAdoptionProfile(); setProfile(defaultProfile); setSubmitted('Your saved context was cleared from this browser.'); }}>Clear</button>}
          <button className="btn-secondary" onClick={close}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={tab === 'profile' ? saveProfile : tab === 'story' ? submitStory : submitRegistration}><Send size={17} />{busy ? 'Saving...' : tab === 'profile' ? 'Save context' : tab === 'story' ? 'Share outcome' : 'Register'}</button>
        </div>
      </>}
    </div>
  </div>;
}

function ProfileForm({ profile, setProfile }: { profile: AdoptionProfile; setProfile: (profile: AdoptionProfile) => void }) {
  return <div className="impact-grid">
    <SelectField id="profile-organization" labelText="Organization type" value={profile.organizationType} values={ORGANIZATION_TYPES} onChange={(organizationType) => setProfile({ ...profile, organizationType: organizationType as OrganizationType })} />
    <SelectField id="profile-role" labelText="Role" value={profile.role} values={IMPACT_ROLES} onChange={(role) => setProfile({ ...profile, role: role as ImpactRole })} />
    <SelectField id="profile-scenario" labelText="Usage scenario" value={profile.usageScenario} values={USAGE_SCENARIOS} onChange={(usageScenario) => setProfile({ ...profile, usageScenario: usageScenario as UsageScenario })} />
    <SelectField id="profile-deployment" labelText="Deployment mode" value={profile.deploymentMode} values={DEPLOYMENT_MODES} onChange={(deploymentMode) => setProfile({ ...profile, deploymentMode: deploymentMode as DeploymentMode })} />
  </div>;
}

function SelectField({ id, labelText, value, values, onChange }: { id: string; labelText: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <div className="form-group"><label htmlFor={id}>{labelText}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div>;
}

function ConsentFields({ nameConsent, setNameConsent, organizationName, setOrganizationName, contactConsent, setContactConsent, email, setEmail, internalConsent, setInternalConsent }: { nameConsent: boolean; setNameConsent: (value: boolean) => void; organizationName: string; setOrganizationName: (value: string) => void; contactConsent: boolean; setContactConsent: (value: boolean) => void; email: string; setEmail: (value: string) => void; internalConsent?: boolean; setInternalConsent?: (value: boolean) => void }) {
  return <div className="form-group full-width impact-grid">
    {setInternalConsent && <label className="impact-consent full-width"><input type="checkbox" checked={internalConsent} onChange={(event) => setInternalConsent(event.target.checked)} />This story may be shared internally at Microsoft</label>}
    <label className="impact-consent full-width"><input type="checkbox" checked={nameConsent} onChange={(event) => setNameConsent(event.target.checked)} />You may store and use the organization/customer name with this record</label>
    {nameConsent && <div className="form-group full-width"><label htmlFor="impact-organization">Organization/customer name</label><input id="impact-organization" type="text" maxLength={200} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></div>}
    <label className="impact-consent full-width"><input type="checkbox" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} />You may contact me about this submission</label>
    {contactConsent && <div className="form-group full-width"><label htmlFor="impact-email">Email</label><input id="impact-email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></div>}
  </div>;
}
