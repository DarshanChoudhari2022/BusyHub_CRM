-- ============================================================================
-- BuzyHub CRM — COMPLETE MASTER Supabase Migration Script
-- Run this ONCE in the Supabase SQL Editor for the NEW project.
-- Creates all tables, columns, constraints, RLS policies, and triggers.
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
  date_joined TIMESTAMPTZ DEFAULT NOW(),
  joining_date DATE,
  advance_taken NUMERIC DEFAULT 0,
  dues_pending NUMERIC DEFAULT 0,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  project TEXT DEFAULT 'society_one',
  home_lat DOUBLE PRECISION,
  home_lng DOUBLE PRECISION,
  home_radius_m INTEGER DEFAULT 150,
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
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
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
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
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
  quotation_id UUID, -- Foreign keys references quotations(id) will be added after quotations table is created
  bill_id UUID,      -- Foreign keys references quotations(id) will be added after quotations table is created
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
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
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
  contact_person_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  method TEXT,
  summary TEXT,
  action_items TEXT,
  pending_items TEXT,
  next_followup_date TIMESTAMPTZ,
  next_followup_assigned TEXT,
  next_followup_assigned_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to TEXT,
  assigned_to_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT,
  description TEXT,
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PROJECTS (Deliverables, Sales & Commission)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  commission_percentage NUMERIC DEFAULT 0,
  budget_revenue NUMERIC DEFAULT 0,
  budget_cost NUMERIC DEFAULT 0,
  description TEXT,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'Medium',
  due_date DATE,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Todo',
  estimated_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  company_name TEXT,
  plan_name TEXT,
  monthly_value NUMERIC DEFAULT 0,
  subscription_status TEXT DEFAULT 'Active',
  joined_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.project_customers(id) ON DELETE SET NULL,
  salesperson_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  amount NUMERIC DEFAULT 0,
  sale_type TEXT DEFAULT 'New',
  sale_date DATE DEFAULT CURRENT_DATE,
  commission_percentage NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  extra_charges NUMERIC DEFAULT 0,
  sale_expenses NUMERIC DEFAULT 0,
  expense_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. FINANCIALS: QUOTATIONS, BILLS & EXPENSES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT,
  number TEXT,
  quotation_number TEXT,
  type TEXT DEFAULT 'Quotation',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  recipient_id UUID,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
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
  received_by_name TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing references for leads to quotations
ALTER TABLE public.leads ADD CONSTRAINT fk_quotation FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT fk_bill FOREIGN KEY (bill_id) REFERENCES public.quotations(id) ON DELETE SET NULL;

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
  title TEXT NOT NULL DEFAULT 'Expense',
  amount NUMERIC NOT NULL,
  category TEXT,
  date DATE,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_sale_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.project_sales(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_name TEXT,
  job_role TEXT DEFAULT 'Salesperson',
  allotted_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  client_name TEXT,
  project_value NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recovery_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  reminder_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recovery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC DEFAULT 0,
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. OPERATIONS & SCHEDULING
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
-- 7. FIELD APP & SHIFTS (DIARY, VISITS & GEOLOCATION)
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
  planned_work TEXT,
  no_work_flag BOOLEAN DEFAULT FALSE,
  work_summary TEXT,
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

CREATE TABLE IF NOT EXISTS public.work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  work_type TEXT,
  location TEXT,
  hours NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  mobile TEXT,
  shop_name TEXT,
  interest_status TEXT DEFAULT 'not_contacted',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  selfie_url TEXT,
  shop_photo_url TEXT,
  next_call_date DATE,
  notes TEXT,
  google_map_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shop_visits_employee_created ON public.shop_visits(employee_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. STORAGE BUCKET CREATION (SAFE RE-RUN)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('field-evidence', 'field-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY (RLS) & GENERAL ACCESS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS across every single table
DO $$ 
DECLARE 
    t_name text;
BEGIN
    FOR t_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(t_name) || ' ENABLE ROW LEVEL SECURITY';
        
        -- Master policy allowing full operations for authenticated administrative/CRM sessions
        EXECUTE 'DROP POLICY IF EXISTS admin_all_policy ON public.' || quote_ident(t_name);
        EXECUTE 'CREATE POLICY admin_all_policy ON public.' || quote_ident(t_name) || ' FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. SPECIFIC FIELD-APP POLICIES FOR EMPLOYEE AUTH ROLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Employees read + update own employee records
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own" ON public.employees FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "employees_update_own" ON public.employees;
CREATE POLICY "employees_update_own" ON public.employees FOR UPDATE USING (auth.uid() = id);

-- Geolocation breadcrumbs
DROP POLICY IF EXISTS "elh_insert_own" ON public.employee_location_history;
CREATE POLICY "elh_insert_own" ON public.employee_location_history FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "elh_select_own" ON public.employee_location_history;
CREATE POLICY "elh_select_own" ON public.employee_location_history FOR SELECT USING (auth.uid() = employee_id);

-- Shift management (check-in / check-out / summaries)
DROP POLICY IF EXISTS "shifts_insert_own" ON public.employee_shifts;
CREATE POLICY "shifts_insert_own" ON public.employee_shifts FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shifts_select_own" ON public.employee_shifts;
CREATE POLICY "shifts_select_own" ON public.employee_shifts FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shifts_update_own" ON public.employee_shifts;
CREATE POLICY "shifts_update_own" ON public.employee_shifts FOR UPDATE USING (auth.uid() = employee_id);

-- Society visits
DROP POLICY IF EXISTS "society_insert_own" ON public.society_data;
CREATE POLICY "society_insert_own" ON public.society_data FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "society_select_own" ON public.society_data;
CREATE POLICY "society_select_own" ON public.society_data FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "society_update_own" ON public.society_data;
CREATE POLICY "society_update_own" ON public.society_data FOR UPDATE USING (auth.uid() = employee_id);

-- Assigned jobs/priorities
DROP POLICY IF EXISTS "assigned_select_own" ON public.assigned_societies;
CREATE POLICY "assigned_select_own" ON public.assigned_societies FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "assigned_update_own" ON public.assigned_societies;
CREATE POLICY "assigned_update_own" ON public.assigned_societies FOR UPDATE USING (auth.uid() = employee_id);

-- Shop visits (Smart Tap AI)
DROP POLICY IF EXISTS "shop_visits_insert_own" ON public.shop_visits;
CREATE POLICY "shop_visits_insert_own" ON public.shop_visits FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shop_visits_select_own" ON public.shop_visits;
CREATE POLICY "shop_visits_select_own" ON public.shop_visits FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shop_visits_update_own" ON public.shop_visits;
CREATE POLICY "shop_visits_update_own" ON public.shop_visits FOR UPDATE USING (auth.uid() = employee_id);

-- Storage bucket upload/read permission
DROP POLICY IF EXISTS "field_evidence_upload" ON storage.objects;
CREATE POLICY "field_evidence_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'field-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "field_evidence_read" ON storage.objects;
CREATE POLICY "field_evidence_read" ON storage.objects FOR SELECT USING (bucket_id = 'field-evidence');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. SHIFT SELFIE AUTO-CLEANUP ROUTINE (2 days interval)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cleanup_old_shift_selfies()
RETURNS TABLE(storage_path TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Return paths that need deletion from storage bucket
  RETURN QUERY
  SELECT regexp_replace(url, '^.*/storage/v1/object/public/field-evidence/', '') AS storage_path
  FROM (
    SELECT start_selfie_url AS url FROM public.employee_shifts
    WHERE start_selfie_url IS NOT NULL AND started_at < NOW() - INTERVAL '2 days'
    UNION ALL
    SELECT end_selfie_url AS url FROM public.employee_shifts
    WHERE end_selfie_url IS NOT NULL AND started_at < NOW() - INTERVAL '2 days'
  ) urls
  WHERE url IS NOT NULL;

  -- Null out the URLs so they aren't returned again
  UPDATE public.employee_shifts
  SET start_selfie_url = NULL, end_selfie_url = NULL
  WHERE (start_selfie_url IS NOT NULL OR end_selfie_url IS NOT NULL)
    AND started_at < NOW() - INTERVAL '2 days';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_shift_selfies() TO service_role;
