import { Doctor } from '../types';

/**
 * ==============================================================================
 * HEALTHCONNECT RULE-BASED SPECIALTY ASSIGNMENT ENGINE
 * ==============================================================================
 * 
 * This is a deterministic rule-based medical specialty recommender, 
 * NOT an AI diagnostic model.
 * It matches patient primary admission condition and department to standard
 * medical disciplines and recommends the best available doctor based on:
 * 1. Exact specialty match
 * 2. Active clinical load (lowest assigned patient count)
 * 3. Real-time online availability
 * ==============================================================================
 */

export interface SpecialtyRule {
  keywords: string[];
  specialty: string;
  department: string;
  description: string;
}

export const SPECIALTY_RULES: SpecialtyRule[] = [
  {
    specialty: 'Cardiology',
    department: 'Cardiology',
    keywords: ['heart', 'cardiac', 'myocardial', 'post-mi', 'infarction', 'angina', 'chest pain', 'arrhythmia', 'hypertension', 'ecg', 'coronary'],
    description: 'Cardiac disorders, myocardial infarction, and cardiovascular monitoring',
  },
  {
    specialty: 'Orthopedics',
    department: 'Orthopedics',
    keywords: ['fracture', 'bone', 'joint', 'femur', 'tibia', 'hip', 'dislocation', 'ligament', 'spine', 'ortho', 'skeletal'],
    description: 'Bone trauma, skeletal fractures, and orthopedic post-op recovery',
  },
  {
    specialty: 'Neurology',
    department: 'Neurology',
    keywords: ['stroke', 'brain', 'seizure', 'neuro', 'ischemic', 'hemorrhage', 'paralysis', 'concussion', 'neuropathy', 'cranial'],
    description: 'Neurological impairments, stroke recovery, and cerebral monitoring',
  },
  {
    specialty: 'Pulmonology',
    department: 'Pulmonology',
    keywords: ['copd', 'asthma', 'respiratory', 'lungs', 'pneumonia', 'dyspnea', 'breathing', 'spO2', 'hypoxia'],
    description: 'Respiratory diseases, airway management, and acute pulmonary conditions',
  },
  {
    specialty: 'General Surgery',
    department: 'Surgery',
    keywords: ['surgery', 'post-op', 'appendicitis', 'hernia', 'wound', 'incision', 'trauma', 'cholecystitis'],
    description: 'Surgical recovery, perioperative care, and post-procedural monitoring',
  },
];

function matchesKeyword(text: string, kw: string): boolean {
  if (kw.length <= 3) {
    const regex = new RegExp(`(^|[^a-zA-Z0-9])${kw}([^a-zA-Z0-9]|$)`, 'i');
    return regex.test(text);
  }
  return text.toLowerCase().includes(kw.toLowerCase());
}

export interface AssignmentRecommendation {
  matchedSpecialty: string;
  department: string;
  rationale: string;
  recommendedDoctor: Doctor | null;
  alternativeDoctors: Doctor[];
  matchingRuleFound: boolean;
}

export function recommendSpecialtyAndDoctor(
  condition: string,
  departmentHint: string,
  availableDoctors: Doctor[]
): AssignmentRecommendation {
  const normalizedCondition = condition.toLowerCase().trim();
  const normalizedDept = departmentHint.toLowerCase().trim();

  // 1. Find matching rule by department or keywords with boundary check
  let matchedRule = SPECIALTY_RULES.find((rule) => {
    return normalizedDept && rule.department.toLowerCase() === normalizedDept;
  });

  if (!matchedRule) {
    matchedRule = SPECIALTY_RULES.find((rule) => {
      return rule.keywords.some((kw) => matchesKeyword(normalizedCondition, kw));
    });
  }

  if (!matchedRule) {
    // Default fallback
    matchedRule = {
      specialty: 'General Medicine',
      department: 'General Medicine',
      keywords: [],
      description: 'General inpatient medical assessment',
    };
  }

  // 2. Filter doctors by specialty
  const eligibleDoctors = availableDoctors.filter(
    (doc) => doc.specialty.toLowerCase() === matchedRule.specialty.toLowerCase()
  );

  // 3. Sort eligible doctors: Online first, then lowest active patient count
  const sortedDoctors = [...eligibleDoctors].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.activePatientCount - b.activePatientCount;
  });

  const bestDoctor = sortedDoctors.length > 0 ? sortedDoctors[0] : null;
  const alternatives = sortedDoctors.length > 1 ? sortedDoctors.slice(1) : [];

  let rationale = `Matched condition "${condition}" to ${matchedRule.specialty} department.`;
  if (bestDoctor) {
    rationale += ` Recommended ${bestDoctor.name} (${bestDoctor.isOnline ? 'Online' : 'Offline'}, currently managing ${bestDoctor.activePatientCount} active ${bestDoctor.activePatientCount === 1 ? 'patient' : 'patients'}).`;
  } else {
    rationale += ` No doctor currently registered under specialty "${matchedRule.specialty}". Manual assignment required.`;
  }

  return {
    matchedSpecialty: matchedRule.specialty,
    department: matchedRule.department,
    rationale,
    recommendedDoctor: bestDoctor,
    alternativeDoctors: alternatives,
    matchingRuleFound: eligibleDoctors.length > 0,
  };
}
