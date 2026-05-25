-- Fix Missing Tables & Columns Script
-- Run this in your Supabase SQL Editor

-- 1. Add missing column to employee_shifts
ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS no_work_flag boolean DEFAULT false;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL,
  priority text DEFAULT 'normal',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Broadcast Contacts Table
CREATE TABLE IF NOT EXISTS public.broadcast_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  phone text,
  email text,
  organization text,
  source text,
  tags text[],
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Broadcast Campaigns Table
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text,
  channel text,
  message_template text,
  status text,
  target_count integer,
  success_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  type text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid,
  lead_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Client Meetings Table
CREATE TABLE IF NOT EXISTS public.client_meetings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- 7. Client Posts Table
CREATE TABLE IF NOT EXISTS public.client_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text,
  content text,
  post_date timestamp with time zone,
  status text,
  link text,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Client Shoots Table
CREATE TABLE IF NOT EXISTS public.client_shoots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  title text,
  shoot_date timestamp with time zone,
  location text,
  status text,
  created_at timestamp with time zone DEFAULT now()
);

-- 9. Employee Fraud Stats View
CREATE OR REPLACE VIEW employee_fraud_stats AS
SELECT 
  e.id as employee_id,
  e.name as employee_name,
  COUNT(sd.id) as total_visits,
  SUM(CASE WHEN sd.verification_status = 'verified' THEN 1 ELSE 0 END) as real_count,
  SUM(CASE WHEN sd.verification_status = 'rejected' THEN 1 ELSE 0 END) as fake_count,
  SUM(CASE WHEN sd.verification_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN sd.is_mock = true THEN 1 ELSE 0 END) as mock_attempts,
  CASE 
    WHEN SUM(CASE WHEN sd.verification_status IN ('verified', 'rejected') THEN 1 ELSE 0 END) = 0 THEN 0
    ELSE ROUND((SUM(CASE WHEN sd.verification_status = 'rejected' THEN 1 ELSE 0 END)::numeric / SUM(CASE WHEN sd.verification_status IN ('verified', 'rejected') THEN 1 ELSE 0 END)) * 100, 2)
  END as fake_pct
FROM employees e
LEFT JOIN society_data sd ON e.id = sd.employee_id
GROUP BY e.id, e.name;
