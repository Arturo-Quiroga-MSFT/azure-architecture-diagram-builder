
export const AADB_EVENTS = [
  'Architecture_Generated',
  'Architecture_Validated',
  'Validation_Handoff',
  'Validation_Compared',
  'Validation_Critique_Ranked',
  'Validation_Findings',
  'DeploymentGuide_Generated',
  'Diagram_Exported',
  'Template_Imported',
  'Image_Imported',
  'Models_Compared',
  'Recommendations_Applied',
  'Version_Operation',
  'Region_Changed',
  'Start_Fresh',
  'Help_Opened',
  'User_Feedback',
  'Feedback_Persist_Failed',
  'AI_Model_Usage',
] as const;

export type AadbEventName = (typeof AADB_EVENTS)[number];

export const EVENT_CATALOG_VERSION = '2.0.0';