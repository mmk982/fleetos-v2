/**
 * Idempotent seed data for Certificates reference tables
 * (`PROJECT_PLAN.md` §1 Seeding / CERTIFICATES_SPEC.md §4).
 *
 * Accepts a Drizzle client so migrate/CLI scripts can seed without importing
 * the `server-only` app pool (`src/db/client.ts`).
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  certificateTypes,
  issuingAuthorities,
  type CertificateAuthority,
  type ReminderRuleKind,
} from "../schema";
import type * as schema from "../schema";

type Db = NodePgDatabase<typeof schema>;

type TypeSeed = {
  authority: CertificateAuthority;
  name: string;
  ruleKind: ReminderRuleKind;
  offsetDays?: number | null;
};

const ISSUING_AUTHORITY_SEEDS: string[] = [
  "NIPPON KAIJI KYOKAI",
  "Lloyd's Register",
  "DNV",
  "Bureau Veritas",
  "American Bureau of Shipping",
  "Panama Maritime Authority",
  "Liberian Registry",
  "Marshall Islands Maritime Administrator",
];

const CERTIFICATE_TYPE_SEEDS: TypeSeed[] = [
  { authority: "flag", name: "Certificate of Registry", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Minimum Safe Manning Document", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "International Tonnage Certificate", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Ship Station Licence", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "LRIT Conformance", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Carving and Marking", ruleKind: "none", offsetDays: null },
  { authority: "flag", name: "Continuous Synopsis Record", ruleKind: "none", offsetDays: null },
  { authority: "flag", name: "Flag — Annual / Short Term / Interim", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Flag — 5 Years", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Ship Sanitation Control Exemption", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Medical Chest Certificate", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Certificate of Inspection", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "flag", name: "Cargo Ship Safety Construction — Annual/Periodical", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "Cargo Ship Safety Construction — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "Cargo Ship Safety Equipment — Annual/Periodical", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "Cargo Ship Safety Equipment — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "Cargo Ship Safety Radio — Annual/Periodical", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "Cargo Ship Safety Radio — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "Load Line — Annual/Periodical", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "Load Line — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IOPP — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IOPP — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IAPP — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IAPP — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "ISPP — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "ISPP — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IBWM — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IBWM — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IAFS — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IAFS — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IHM — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IHM — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "flag", name: "IMSBC/DG — Annual/Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "flag", name: "IMSBC/DG — Renewal", ruleKind: "expiry_offset", offsetDays: 180 },

  { authority: "class", name: "Classification Certificate", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "class", name: "Class — Annual Survey", ruleKind: "window", offsetDays: null },
  { authority: "class", name: "Class — Intermediate Survey", ruleKind: "window", offsetDays: null },
  { authority: "class", name: "Class — Renewal / Special Survey", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "class", name: "Dry Dock / Bottom Survey", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "class", name: "IEEC", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "class", name: "Cargo Gear", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "class", name: "Grain", ruleKind: "expiry_offset", offsetDays: 30 },

  { authority: "insurance", name: "H&M / War Risk", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "P&I Certificate of Insurance", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "CLC", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "Bunker Convention / Blue Card", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "Wreck Removal / Blue Card", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "MLC Financial Security", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "BBC", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "insurance", name: "FD&D", ruleKind: "expiry_offset", offsetDays: 30 },

  { authority: "management", name: "SMC — Interim / Short Term", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "SMC — Annual", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "SMC — Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "management", name: "SMC — Renewal / Full Term", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "management", name: "MLC — Interim / Short Term", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "MLC — Annual", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "MLC — Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "management", name: "MLC — Renewal / Full Term", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "management", name: "ISSC — Interim / Short Term", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "ISSC — Annual", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "ISSC — Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "management", name: "ISSC — Renewal / Full Term", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "management", name: "DOC — Interim / Short Term", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "DOC — Annual", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "management", name: "DOC — Intermediate", ruleKind: "window", offsetDays: null },
  { authority: "management", name: "DOC — Renewal / Full Term", ruleKind: "expiry_offset", offsetDays: 180 },
  { authority: "management", name: "DMLC Part II", ruleKind: "expiry_offset", offsetDays: 30 },

  { authority: "radio", name: "Radio / GMDSS Annual Certificate", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "SSAS Test", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "AIS Test", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "EPIRB Test", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "SART Test", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "INMARSAT C", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "EPIRB Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "EPIRB HRU", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "SART Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "VHF Portable Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "AIS-SART Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "radio", name: "Liferaft HRU", ruleKind: "expiry_offset", offsetDays: 30 },

  { authority: "safety", name: "Fire Extinguisher Inspection", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "CO2 System", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "SCBA / EEBD", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "EEBD Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Medical Oxygen", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Immersion Suits", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Fireman's Outfit", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Water Mist / Sprinkler", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Foam Applicator / System", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "OWS / 15PPM", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Gas Detector Calibration", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Gyro / Magnetic Compass Service", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Lifeboat / Rescue Boat Annual Service", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Lifeboat / Rescue Boat Load Test", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "Davit / Winch / Hook Service", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "VDR / APT Annual", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "VDR Battery", ruleKind: "expiry_offset", offsetDays: 30 },
  { authority: "safety", name: "VDR Certificate / COC / APT Report", ruleKind: "expiry_offset", offsetDays: 30 },
];

/** Inserts missing seeded rows. Idempotent via unique constraints. */
export async function seedCertificateReferenceData(db: Db): Promise<{
  authorities: number;
  types: number;
}> {
  for (const name of ISSUING_AUTHORITY_SEEDS) {
    await db
      .insert(issuingAuthorities)
      .values({ name, isCustom: false })
      .onConflictDoNothing({ target: issuingAuthorities.name });
  }

  for (const row of CERTIFICATE_TYPE_SEEDS) {
    await db
      .insert(certificateTypes)
      .values({
        authority: row.authority,
        name: row.name,
        ruleKind: row.ruleKind,
        offsetDays: row.offsetDays ?? null,
        isCustom: false,
      })
      .onConflictDoNothing({
        target: [certificateTypes.authority, certificateTypes.name],
      });
  }

  return {
    authorities: ISSUING_AUTHORITY_SEEDS.length,
    types: CERTIFICATE_TYPE_SEEDS.length,
  };
}
