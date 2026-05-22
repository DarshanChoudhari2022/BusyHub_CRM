-- ============================================================================
-- BuzyHub CRM — COMPLETE Supabase Migration Script
-- Run this ONCE in the Supabase SQL Editor for the NEW project.
-- Creates all tables, columns, constraints, and RLS policies.
-- ============================================================================

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CORE: EMPLOYEES & PARTNERS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Employee',
  custom_role TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  aadhar TEXT,
  bank_account TEXT,
  ifsc TEXT,
  account_holder TEXT,
  bank_name TEXT,
  upi TEXT,
  contract_type TEXT DEFAULT 'Monthly',
  base_rate NUMERIC DEFAULT 0,
  salary NUMERIC DEFAULT 0,
  lead_target INTEGER DEFAULT 50,
  lead_target_daily INTEGER DEFAULT 15,
  status TEXT DEFAULT 'Active',
  on_field_today BOOLEAN DEFAULT false,
  date_joined TIMESTAMPTZ,
  joining_date DATE,
  advance_taken NUMERIC DEFAULT 0,
  dues_pending NUMERIC DEFAULT 0,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  pan TEXT,
  bank_account TEXT,
  ifsc TEXT,
  account_holder TEXT,
  bank_name TEXT,
  upi TEXT,
  partner_since DATE,
  status TEXT DEFAULT 'Active',
  category TEXT,
  commission_type TEXT,
  commission_rate NUMERIC DEFAULT 0,
  agreement_date DATE,
  agreement_terms TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CRM: CLIENTS & SERVICES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  area TEXT,
  contact_person TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  gst TEXT,
  pan TEXT,
  contract_start DATE,
  contract_end DATE,
  monthly_retainer NUMERIC DEFAULT 0,
  partner_id UUID REFERENCES public.partners(id),
  partner_name TEXT,
  status TEXT DEFAULT 'Active',
  total_billed NUMERIC DEFAULT 0,
  outstanding NUMERIC DEFAULT 0,
  payment_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  monthly_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CRM: LEADS (including Smart Leads)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT,
  category TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  constituency TEXT,
  source TEXT,
  referrer_name TEXT,
  referrer_phone TEXT,
  partner_id UUID REFERENCES public.partners(id),
  assigned_to UUID REFERENCES public.employees(id),
  stage TEXT DEFAULT 'New',
  heat TEXT DEFAULT 'Warm',
  estimated_value NUMERIC DEFAULT 0,
  date_received TIMESTAMPTZ DEFAULT NOW(),
  expected_close DATE,
  last_contact_date TIMESTAMPTZ,
  next_followup_date TIMESTAMPTZ,
  last_interaction_date TIMESTAMPTZ,
  action_item TEXT,
  next_call_date TIMESTAMPTZ,
  quotation_status TEXT,
  quotation_id UUID,
  bill_id UUID,
  payment_due_date DATE,
  payment_status TEXT,
  lifecycle_stage TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT,
  category TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  source TEXT,
  stage TEXT DEFAULT 'New',
  heat TEXT DEFAULT 'Warm',
  estimated_value NUMERIC DEFAULT 0,
  assigned_to UUID REFERENCES public.employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  datetime TIMESTAMPTZ DEFAULT NOW(),
  contact_person TEXT,
  contact_person_id UUID REFERENCES public.employees(id),
  method TEXT,
  summary TEXT,
  action_items TEXT,
  pending_items TEXT,
  next_followup_date TIMESTAMPTZ,
  next_followup_assigned TEXT,
  next_followup_assigned_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to TEXT,
  assigned_to_id UUID REFERENCES public.employees(id),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT,
  description TEXT,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. FINANCIALS: QUOTATIONS, PAYMENTS & EXPENSES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT,
  number TEXT,
  quotation_number TEXT,
  type TEXT DEFAULT 'Quotation',
  client_id UUID REFERENCES public.clients(id),
  recipient_id UUID,
  lead_id UUID REFERENCES public.leads(id),
  client_name TEXT,
  recipient_name TEXT,
  is_client BOOLEAN DEFAULT true,
  client_address TEXT,
  client_phone TEXT,
  client_email TEXT,
  client_gst TEXT,
  date DATE,
  valid_until DATE,
  due_date DATE,
  subtotal NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'flat',
  gst_applicable BOOLEAN DEFAULT false,
  gst_rate NUMERIC DEFAULT 0,
  cgst NUMERIC DEFAULT 0,
  sgst NUMERIC DEFAULT 0,
  cgst_amount NUMERIC DEFAULT 0,
  sgst_amount NUMERIC DEFAULT 0,
  cgst_percent NUMERIC DEFAULT 0,
  sgst_percent NUMERIC DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  is_bill BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Draft',
  notes TEXT,
  internal_notes TEXT,
  terms TEXT,
  sent_via TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing references for leads
ALTER TABLE public.leads ADD CONSTRAINT fk_quotation FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);
ALTER TABLE public.leads ADD CONSTRAINT fk_bill FOREIGN KEY (bill_id) REFERENCES public.quotations(id);

CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_no TEXT,
  date DATE,
  amount NUMERIC DEFAULT 0,
  status TEXT,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  category TEXT,
  date DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. OPERATIONS & SCHEDULING
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sales_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date DATE,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. FIELD APP (EMPLOYEE SHIFTS & TRACKING)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.employee_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accuracy_m DOUBLE PRECISION,
  is_mock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_elh_employee_ts ON public.employee_location_history(employee_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  start_selfie_url TEXT,
  end_selfie_url TEXT,
  duration_min INTEGER,
  visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_started ON public.employee_shifts(employee_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.society_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  number_of_flats INTEGER,
  status TEXT DEFAULT 'Pending',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  is_mock BOOLEAN DEFAULT FALSE,
  selfie_url TEXT,
  building_photo_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_society_employee_created ON public.society_data(employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.assigned_societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  society_name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visited_at TIMESTAMPTZ,
  visit_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assigned_employee_date ON public.assigned_societies(employee_id, assigned_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. ENABLE ROW LEVEL SECURITY AND ADD WIDE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Disable RLS restrictions for authenticated CRM users across the board 
-- (assuming this CRM runs with authenticated session = admin rights).

DO $$ 
DECLARE 
    t_name text;
BEGIN
    FOR t_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ENABLE ROW LEVEL SECURITY';
        
        -- Drop if exists and recreate policy to allow all actions for authenticated users
        EXECUTE 'DROP POLICY IF EXISTS admin_all_policy ON public.' || quote_ident(t_name);
        EXECUTE 'CREATE POLICY admin_all_policy ON public.' || quote_ident(t_name) || ' FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
    END LOOP;
END $$;
