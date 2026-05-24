import type { Quotation } from "@/types";

import { PROFESSIONAL_TERMS_QUOTATION, PROFESSIONAL_TERMS_BILL } from "@/lib/pdf";

export const DEFAULT_TERMS_QUOTATION = PROFESSIONAL_TERMS_QUOTATION.join("\n");
export const DEFAULT_TERMS_BILL = PROFESSIONAL_TERMS_BILL.join("\n");

// Keep backward-compatible export
export const DEFAULT_TERMS = DEFAULT_TERMS_QUOTATION;

export const SERVICE_PRESETS: { serviceName: string; rate: number; unit: string }[] = [];

export const quotations: Quotation[] = [];
