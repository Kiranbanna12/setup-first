-- =====================================================
-- XROZEN FLOW - COMPLETE DATABASE SCHEMA
-- Single file for new database setup
-- Generated: 2025-12-05 (Consolidated with ALL migrations)
-- =====================================================
-- 
-- This file contains all database tables, functions, 
-- policies, triggers, and indexes needed for the app.
-- Run this on a fresh Supabase project to set up everything.
--
-- BIDIRECTIONAL LOGIC:
-- - When User 1 adds User 2 as EDITOR → User 2 sees User 1 in CLIENTS
-- - When User 1 adds User 2 as CLIENT → User 2 sees User 1 in EDITORS
-- This is achieved via email matching in RLS policies
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ENUMS (Custom Types)
-- =====================================================

-- User categories
DO $$ BEGIN
  CREATE TYPE user_category AS ENUM ('editor', 'client', 'agency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Application roles (for admin system)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscription tiers
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Project status
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('draft', 'in_review', 'approved', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment types
DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('freelance', 'fulltime');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment status
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Employment type
DO $$ BEGIN
  CREATE TYPE employment_type AS ENUM ('fulltime', 'freelance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approval status
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'corrections_needed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification type
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'project_created',
    'project_assigned',
    'project_status_changed',
    'version_added',
    'deadline_approaching',
    'deadline_overdue',
    'feedback_added',
    'feedback_replied',
    'correction_requested',
    'project_approved',
    'project_rejected',
    'invoice_generated',
    'invoice_due',
    'invoice_overdue',
    'payment_received',
    'payment_failed',
    'chat_message',
    'subscription_expiring',
    'subscription_renewed',
    'system_alert',
    'user_mentioned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notification priority
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('info', 'important', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice status
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Transaction type
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('expense', 'payment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- 2. CORE TABLES
-- =====================================================

-- Profiles table (User information - linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  user_category TEXT DEFAULT 'editor',
  subscription_tier TEXT DEFAULT 'basic',
  subscription_active BOOLEAN DEFAULT true,
  company_name TEXT,
  phone_number TEXT,
  trial_end_date TIMESTAMPTZ,
  subscription_start_date TIMESTAMPTZ,
  password_hash TEXT,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  subscription_shown BOOLEAN DEFAULT FALSE,
  general_settings JSONB DEFAULT '{"email_notifications": true, "push_notifications": true, "sound_enabled": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (for admin/moderator roles - SEPARATE from profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- =====================================================
-- EDITORS TABLE (with created_by for bidirectional access)
-- When User1 adds User2 here as editor, User2 sees User1 in their CLIENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  specialty TEXT,
  employment_type TEXT DEFAULT 'freelance',
  hourly_rate DECIMAL(10,2),
  monthly_salary DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- CLIENTS TABLE (with created_by for bidirectional access)
-- When User1 adds User2 here as client, User2 sees User1 in their EDITORS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  employment_type TEXT DEFAULT 'freelance',
  project_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'in_progress', 'in_review', 'review', 'approved', 'completed', 'cancelled')),
  deadline TIMESTAMPTZ,
  raw_footage_link TEXT,
  assigned_date DATE,
  fee DECIMAL(10,2),
  client_fee DECIMAL(10,2),
  editor_fee DECIMAL(10,2),
  agency_margin DECIMAL(10,2),
  hide_editor_from_client BOOLEAN DEFAULT false,
  parent_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  is_subproject BOOLEAN DEFAULT false,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  editor_id UUID REFERENCES public.editors(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project clients junction table
CREATE TABLE IF NOT EXISTS public.project_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, client_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  reactions JSONB DEFAULT '[]'::jsonb,
  is_edited BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent',
  read_by TEXT[] DEFAULT '{}',
  delivered_to TEXT[] DEFAULT '{}',
  reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Video versions table
CREATE TABLE IF NOT EXISTS public.video_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER DEFAULT 1,
  preview_url TEXT,
  final_url TEXT,
  is_approved BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  final_link_requested BOOLEAN DEFAULT false,
  correction_notes TEXT,
  feedback TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Video feedback table (timestamped comments on video versions)
CREATE TABLE IF NOT EXISTS public.video_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.video_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  timestamp_seconds INTEGER,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Feedback table (timestamped comments on video)
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID REFERENCES public.video_versions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_seconds NUMERIC,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project types table (for autocomplete)
CREATE TABLE IF NOT EXISTS public.project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. NOTIFICATION SYSTEM TABLES
-- =====================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications JSONB DEFAULT '{}',
  in_app_notifications JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email configurations table
CREATE TABLE IF NOT EXISTS public.email_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Email logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID REFERENCES public.email_configurations(id),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INVITATIONS TABLE (For Accept/Deny Editor/Client)
-- When User1 adds User2 as editor/client, an invitation is created
-- User2 can accept or deny the invitation
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('editor', 'client')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  editor_id UUID REFERENCES public.editors(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- =====================================================
-- 4. PAYMENT & INVOICE TABLES
-- =====================================================

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  transaction_id TEXT,
  invoice_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 5. ADMIN SYSTEM TABLES
-- =====================================================

-- API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  current_usage INTEGER DEFAULT 0,
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Admin activity logs table
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC DEFAULT 0,
  price_inr NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  user_category TEXT DEFAULT 'editor',
  client_limit INTEGER,
  editor_limit INTEGER,
  billing_period TEXT DEFAULT 'monthly',
  tier TEXT DEFAULT 'basic',
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  transaction_type TEXT,
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Advances table (for tracking advance payments to editors/clients)
CREATE TABLE IF NOT EXISTS public.advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('editor', 'client')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  advance_date DATE DEFAULT CURRENT_DATE,
  is_deducted BOOLEAN DEFAULT false,
  deducted_in_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice projects junction table
CREATE TABLE IF NOT EXISTS public.invoice_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_fee NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, project_id)
);

-- Database config table for admin
CREATE TABLE IF NOT EXISTS public.database_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'supabase',
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Broadcast messages table
CREATE TABLE IF NOT EXISTS public.broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_users TEXT[] NOT NULL DEFAULT '{}',
  sent_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Messages table
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Provider Configurations table (for Xrozen AI model selection)
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'google', 'anthropic', 'mistral', 'cohere')),
  model TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  usage_limit INTEGER,
  current_usage INTEGER DEFAULT 0,
  environment TEXT DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- OTP CODES TABLE (For Two-Factor Authentication)
-- =====================================================

-- OTP codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SHARING TABLES (For sharing editors/clients with other users)
-- =====================================================

-- Editor shares table
CREATE TABLE IF NOT EXISTS public.editor_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editor_id UUID NOT NULL REFERENCES public.editors(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(editor_id, shared_with_email)
);

-- Client shares table
CREATE TABLE IF NOT EXISTS public.client_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, shared_with_email)
);

-- =====================================================
-- PROJECT SHARING TABLES
-- =====================================================

-- Project shares table (for public sharing via tokens)
CREATE TABLE IF NOT EXISTS public.project_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_chat BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project share access logs table
CREATE TABLE IF NOT EXISTS public.project_share_access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  guest_identifier TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT now()
);

-- Project chat members table
CREATE TABLE IF NOT EXISTS public.project_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  is_active BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- User accessed shares table
CREATE TABLE IF NOT EXISTS public.user_accessed_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT false,
  can_chat BOOLEAN DEFAULT false,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, share_id)
);

-- =====================================================
-- NOTES TABLE
-- =====================================================

-- Notes table (for project notes)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'rich' CHECK (type IN ('rich', 'text')),
  is_favorite BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SUBSCRIPTION MANAGEMENT TABLES
-- =====================================================

-- App settings table (for storing app-wide settings like razorpay_config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled', 'expired', 'limited', 'trial')),
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ,
  payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 6. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.database_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_share_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accessed_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to check user roles (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user signup - creates profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, user_category, subscription_tier, trial_end_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'user_category', 'editor'),
    'basic',
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to create user profile with custom ID
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_id uuid,
  p_email text,
  p_full_name text,
  p_user_category text,
  p_password_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    user_category,
    password_hash,
    subscription_active,
    subscription_tier,
    trial_end_date,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    p_email,
    p_full_name,
    p_user_category,
    p_password_hash,
    true,
    'basic',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
  );
  
  RETURN p_id;
END;
$$;

-- Function to automatically assign default role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get the user_category from metadata and map it to app_role
  user_role := COALESCE((NEW.raw_user_meta_data->>'user_category')::app_role, 'user'::app_role);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to sync user_category with user_roles
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing role
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  
  -- Insert new role based on user_category
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to auto-delete expired notifications
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;

-- Function to create notification securely (checking preferences)
CREATE OR REPLACE FUNCTION public.create_notification(
  recipient_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  priority TEXT DEFAULT 'info'
) RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  pref_record RECORD;
  in_app_enabled BOOLEAN := TRUE;
BEGIN
  -- 1. Check Granular Preference
  SELECT in_app_notifications INTO pref_record
  FROM public.notification_preferences
  WHERE user_id = recipient_id;

  IF FOUND THEN
    IF (pref_record.in_app_notifications ->> type)::boolean IS FALSE THEN
        in_app_enabled := FALSE;
    END IF;
  END IF;

  -- 2. Insert if enabled
  IF in_app_enabled THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata, priority)
    VALUES (recipient_id, type, title, message, link, metadata, priority);
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Function to auto-link shares when a new user registers
CREATE OR REPLACE FUNCTION public.link_editor_shares_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update editor_shares where email matches
  UPDATE public.editor_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  -- Update client_shares where email matches
  UPDATE public.client_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Function to generate and store OTP
CREATE OR REPLACE FUNCTION public.generate_otp(p_user_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate random 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Delete any existing unused OTPs for this user
  DELETE FROM public.otp_codes WHERE user_id = p_user_id AND used = false;
  
  -- Insert new OTP with 10 minute expiry
  INSERT INTO public.otp_codes (user_id, email, code, expires_at)
  VALUES (p_user_id, p_email, v_code, now() + INTERVAL '10 minutes');
  
  RETURN v_code;
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN := false;
BEGIN
  -- Check if valid OTP exists
  UPDATE public.otp_codes
  SET used = true
  WHERE user_id = p_user_id
    AND code = p_code
    AND expires_at > now()
    AND used = false
  RETURNING true INTO v_valid;
  
  RETURN COALESCE(v_valid, false);
END;
$$;

-- Function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now() OR used = true;
END;
$$;

-- =====================================================
-- PROJECT SHARING RPC FUNCTIONS
-- =====================================================

-- Function to get shared project data securely by token
CREATE OR REPLACE FUNCTION public.get_shared_project_data(share_token_input TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    share_record record;
    project_record record;
    result json;
    versions_arr json;
    sub_projects_arr json;
BEGIN
    -- 1. Get Share Info
    SELECT * INTO share_record
    FROM project_shares
    WHERE share_token = share_token_input AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Invalid or inactive share link');
    END IF;

    -- 2. Get Project Info
    SELECT * INTO project_record
    FROM projects
    WHERE id = share_record.project_id;

    -- 3. Get Versions and Sub-Projects (if can_view)
    IF share_record.can_view THEN
         -- Main Project Versions
         SELECT json_agg(v) INTO versions_arr FROM (
            SELECT * FROM video_versions 
            WHERE project_id = share_record.project_id 
            ORDER BY version_number DESC
         ) v;
         
         -- Sub-Projects with their Versions
         SELECT json_agg(sp) INTO sub_projects_arr FROM (
             SELECT 
                p.*,
                (
                    SELECT json_agg(v) FROM (
                        SELECT * FROM video_versions 
                        WHERE project_id = p.id 
                        ORDER BY version_number DESC
                    ) v
                ) as versions
             FROM projects p
             WHERE p.parent_project_id = share_record.project_id
             ORDER BY p.created_at DESC
         ) sp;
         
    ELSE
         versions_arr := '[]'::json;
         sub_projects_arr := '[]'::json;
    END IF;

    -- 4. Construct Result
    result := json_build_object(
        'share', row_to_json(share_record),
        'project', row_to_json(project_record),
        'versions', COALESCE(versions_arr, '[]'::json),
        'sub_projects', COALESCE(sub_projects_arr, '[]'::json)
    );

    RETURN result;
END;
$$;

-- Function to log share access securely
CREATE OR REPLACE FUNCTION public.log_share_access_rpc(token text, agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    share_id_val uuid;
BEGIN
    SELECT id INTO share_id_val FROM project_shares WHERE share_token = token;
    
    IF share_id_val IS NOT NULL THEN
        INSERT INTO project_share_access_logs (share_id, user_agent, accessed_at)
        VALUES (share_id_val, agent, now());
    END IF;
END;
$$;

-- Function to get video version by share link
CREATE OR REPLACE FUNCTION public.get_video_version_by_share(
    version_id_input UUID,
    share_token_input TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    share_record record;
    version_record record;
    project_record record;
    all_versions json;
    feedback_arr json;
    result json;
    is_sub_project boolean;
BEGIN
    -- 1. Validate share token
    SELECT * INTO share_record
    FROM project_shares
    WHERE share_token = share_token_input AND is_active = true;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Invalid or inactive share link');
    END IF;

    -- 2. Validate version exists
    SELECT * INTO version_record
    FROM video_versions
    WHERE id = version_id_input;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Version not found');
    END IF;

    -- 3. Verify version belongs to shared project OR a sub-project
    is_sub_project := false;
    
    IF version_record.project_id != share_record.project_id THEN
        SELECT EXISTS (
            SELECT 1 FROM projects 
            WHERE id = version_record.project_id 
            AND parent_project_id = share_record.project_id
        ) INTO is_sub_project;

        IF NOT is_sub_project THEN
            RETURN json_build_object('error', 'Version does not belong to shared project');
        END IF;
    END IF;

    -- 4. Check view permission
    IF NOT share_record.can_view THEN
        RETURN json_build_object('error', 'No view permission for this share');
    END IF;

    -- 5. Get project details
    SELECT * INTO project_record
    FROM projects
    WHERE id = version_record.project_id;

    -- 6. Get all versions for navigation
    SELECT json_agg(v ORDER BY v.version_number DESC) INTO all_versions
    FROM video_versions v
    WHERE v.project_id = version_record.project_id;

    -- 7. Get feedback for this version
    SELECT json_agg(
        json_build_object(
            'id', f.id,
            'version_id', f.version_id,
            'user_id', f.user_id,
            'comment_text', f.comment_text,
            'timestamp_seconds', f.timestamp_seconds,
            'is_resolved', f.is_resolved,
            'created_at', f.created_at,
            'updated_at', f.updated_at
        ) ORDER BY f.timestamp_seconds ASC
    ) INTO feedback_arr
    FROM video_feedback f
    WHERE f.version_id = version_id_input;

    -- 8. Construct result
    result := json_build_object(
        'version', row_to_json(version_record),
        'project', row_to_json(project_record),
        'versions', COALESCE(all_versions, '[]'::json),
        'feedback', COALESCE(feedback_arr, '[]'::json),
        'share', json_build_object(
            'can_view', share_record.can_view,
            'can_edit', share_record.can_edit,
            'can_chat', share_record.can_chat
        )
    );

    RETURN result;
END;
$$;

-- Function to get pending chat join requests
CREATE OR REPLACE FUNCTION public.get_pending_join_requests(project_id_input uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    result JSON;
    project_owner_id UUID;
    project_editor_id UUID;
    project_client_id UUID;
    is_active_member BOOLEAN;
    is_assigned_editor BOOLEAN;
    is_assigned_client BOOLEAN;
BEGIN
    -- Get the project owner, editor, and client IDs
    SELECT created_by, editor_id, client_id 
    INTO project_owner_id, project_editor_id, project_client_id 
    FROM projects 
    WHERE id = project_id_input;
    
    IF project_owner_id IS NULL THEN
        RETURN '[]'::json;
    END IF;
    
    -- Check if current user is an active chat member
    SELECT EXISTS (
        SELECT 1 FROM project_chat_members
        WHERE project_id = project_id_input
        AND user_id = auth.uid()
        AND is_active = true
    ) INTO is_active_member;
    
    -- Check if current user is the assigned editor
    SELECT EXISTS (
        SELECT 1 FROM editors
        WHERE id = project_editor_id
        AND user_id = auth.uid()
    ) INTO is_assigned_editor;
    
    -- Check if current user is the assigned client
    SELECT EXISTS (
        SELECT 1 FROM clients
        WHERE id = project_client_id
        AND user_id = auth.uid()
    ) INTO is_assigned_client;
    
    -- Return pending requests if authorized
    IF auth.uid() != project_owner_id 
       AND NOT is_assigned_editor 
       AND NOT is_assigned_client 
       AND NOT is_active_member THEN
        RETURN '[]'::json;
    END IF;
    
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO result
    FROM (
        SELECT 
            pcm.id,
            pcm.user_id,
            pcm.status,
            pcm.is_active,
            pcm.joined_at as created_at,
            p.full_name as user_name,
            p.email as user_email,
            p.avatar_url as user_avatar
        FROM project_chat_members pcm
        LEFT JOIN profiles p ON p.id = pcm.user_id
        WHERE pcm.project_id = project_id_input
        AND pcm.status = 'pending'
        AND pcm.is_active = false
    ) t;
    
    RETURN result;
END;
$function$;

-- Function to approve a chat join request
CREATE OR REPLACE FUNCTION public.approve_chat_join_request(
    request_id uuid,
    project_id_input uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    project_owner_id UUID;
    project_editor_id UUID;
    project_client_id UUID;
    is_authorized BOOLEAN := false;
    request_exists BOOLEAN;
BEGIN
    -- Get project details
    SELECT created_by, editor_id, client_id 
    INTO project_owner_id, project_editor_id, project_client_id 
    FROM projects 
    WHERE id = project_id_input;
    
    -- Check if request exists
    SELECT EXISTS (
        SELECT 1 FROM project_chat_members
        WHERE id = request_id
        AND project_id = project_id_input
        AND status = 'pending'
    ) INTO request_exists;
    
    IF NOT request_exists THEN
        RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
    END IF;
    
    -- Check authorization: project owner
    IF auth.uid() = project_owner_id THEN
        is_authorized := true;
    END IF;
    
    -- Check authorization: assigned editor
    IF NOT is_authorized AND project_editor_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM editors WHERE id = project_editor_id AND user_id = auth.uid()
        ) INTO is_authorized;
    END IF;
    
    -- Check authorization: assigned client
    IF NOT is_authorized AND project_client_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM clients WHERE id = project_client_id AND user_id = auth.uid()
        ) INTO is_authorized;
    END IF;
    
    IF NOT is_authorized THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to approve requests');
    END IF;
    
    -- Update the request to approved
    UPDATE project_chat_members
    SET status = 'approved',
        is_active = true,
        updated_at = NOW()
    WHERE id = request_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

-- Function to reject a chat join request
CREATE OR REPLACE FUNCTION public.reject_chat_join_request(
    request_id uuid,
    project_id_input uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    project_owner_id UUID;
    project_editor_id UUID;
    project_client_id UUID;
    is_authorized BOOLEAN := false;
    request_exists BOOLEAN;
BEGIN
    -- Get project details
    SELECT created_by, editor_id, client_id 
    INTO project_owner_id, project_editor_id, project_client_id 
    FROM projects 
    WHERE id = project_id_input;
    
    -- Check if request exists
    SELECT EXISTS (
        SELECT 1 FROM project_chat_members
        WHERE id = request_id
        AND project_id = project_id_input
        AND status = 'pending'
    ) INTO request_exists;
    
    IF NOT request_exists THEN
        RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
    END IF;
    
    -- Check authorization: project owner
    IF auth.uid() = project_owner_id THEN
        is_authorized := true;
    END IF;
    
    -- Check authorization: assigned editor
    IF NOT is_authorized AND project_editor_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM editors WHERE id = project_editor_id AND user_id = auth.uid()
        ) INTO is_authorized;
    END IF;
    
    -- Check authorization: assigned client
    IF NOT is_authorized AND project_client_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM clients WHERE id = project_client_id AND user_id = auth.uid()
        ) INTO is_authorized;
    END IF;
    
    IF NOT is_authorized THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to reject requests');
    END IF;
    
    -- Delete the request
    DELETE FROM project_chat_members
    WHERE id = request_id;
    
    RETURN json_build_object('success', true);
END;
$function$;

-- Grant execute on public functions
GRANT EXECUTE ON FUNCTION get_shared_project_data(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION log_share_access_rpc(text, text) TO anon, authenticated, service_role;

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_editors_updated_at
  BEFORE UPDATE ON public.editors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_video_versions_updated_at
  BEFORE UPDATE ON public.video_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_video_feedback_updated_at
  BEFORE UPDATE ON public.video_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_database_config_updated_at
  BEFORE UPDATE ON public.database_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for new user role assignment
DROP TRIGGER IF EXISTS on_auth_user_role_created ON auth.users;
CREATE TRIGGER on_auth_user_role_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Trigger to sync user_category changes
DROP TRIGGER IF EXISTS sync_user_category_to_role ON public.profiles;
CREATE TRIGGER sync_user_category_to_role
  AFTER UPDATE OF user_category ON public.profiles
  FOR EACH ROW
  WHEN (OLD.user_category IS DISTINCT FROM NEW.user_category)
  EXECUTE FUNCTION public.sync_user_role();

-- Trigger for auto-linking shares when profile is created
DROP TRIGGER IF EXISTS on_profile_created_link_shares ON public.profiles;
CREATE TRIGGER on_profile_created_link_shares
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.link_editor_shares_on_signup();

-- =====================================================
-- 9. RLS POLICIES
-- =====================================================

-- ================== PROFILES ==================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ================== USER ROLES ==================
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- ================== EDITORS (BIDIRECTIONAL ACCESS) ==================
-- LOGIC: User can see editors if:
--   1. They created the editor entry (created_by = me)
--   2. Their email matches the editor's email (they ARE that editor)
--   3. Their user_id matches the editor's user_id
DROP POLICY IF EXISTS "Users can view own editors and linked" ON public.editors;
CREATE POLICY "Users can view own editors and linked"
ON public.editors FOR SELECT
USING (
  created_by = auth.uid() OR
  user_id = auth.uid() OR
  LOWER(TRIM(email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid())))
);

DROP POLICY IF EXISTS "Users can insert editors" ON public.editors;
CREATE POLICY "Users can insert editors"
ON public.editors FOR INSERT
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own editors" ON public.editors;
CREATE POLICY "Users can update own editors"
ON public.editors FOR UPDATE
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own editors" ON public.editors;
CREATE POLICY "Users can delete own editors"
ON public.editors FOR DELETE
USING (created_by = auth.uid());

-- ================== CLIENTS (BIDIRECTIONAL ACCESS) ==================
-- LOGIC: User can see clients if:
--   1. They created the client entry (created_by = me)
--   2. Their email matches the client's email (they ARE that client)
--   3. Their user_id matches the client's user_id
DROP POLICY IF EXISTS "Users can view own clients and linked" ON public.clients;
CREATE POLICY "Users can view own clients and linked"
ON public.clients FOR SELECT
USING (
  created_by = auth.uid() OR
  user_id = auth.uid() OR
  LOWER(TRIM(email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid())))
);

DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;
CREATE POLICY "Users can insert clients"
ON public.clients FOR INSERT
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients"
ON public.clients FOR UPDATE
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Users can delete own clients"
ON public.clients FOR DELETE
USING (created_by = auth.uid());

-- ================== PROJECTS ==================
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (created_by = auth.uid());

-- Policy: Users can view projects assigned to them as editor
DROP POLICY IF EXISTS "Users can view assigned projects as editor" ON public.projects;
CREATE POLICY "Users can view assigned projects as editor" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.editors e 
      WHERE e.id = projects.editor_id 
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Policy: Users can view projects assigned to them as client
DROP POLICY IF EXISTS "Users can view assigned projects as client" ON public.projects;
CREATE POLICY "Users can view assigned projects as client" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = projects.client_id 
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned editors to update projects (status, etc.)
DROP POLICY IF EXISTS "Assigned editors can update projects" ON public.projects;
CREATE POLICY "Assigned editors can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.editors e 
      WHERE e.id = projects.editor_id 
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to update projects (status, etc.)
DROP POLICY IF EXISTS "Assigned clients can update projects" ON public.projects;
CREATE POLICY "Assigned clients can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = projects.client_id 
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- ================== PROJECT CLIENTS ==================
DROP POLICY IF EXISTS "Users can view project clients they're part of" ON public.project_clients;
CREATE POLICY "Users can view project clients they're part of" ON public.project_clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND created_by = auth.uid()
    ) OR client_id = auth.uid()
  );

DROP POLICY IF EXISTS "Project creators can manage project clients" ON public.project_clients;
CREATE POLICY "Project creators can manage project clients" ON public.project_clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND created_by = auth.uid()
    )
  );

-- ================== MESSAGES ==================
DROP POLICY IF EXISTS "Users can view project messages" ON public.messages;
CREATE POLICY "Users can view project messages" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Allow assigned editors to view project messages
DROP POLICY IF EXISTS "Assigned editors can view messages" ON public.messages;
CREATE POLICY "Assigned editors can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.editors e ON e.id = p.editor_id
      WHERE p.id = messages.project_id
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to view project messages
DROP POLICY IF EXISTS "Assigned clients can view messages" ON public.messages;
CREATE POLICY "Assigned clients can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = messages.project_id
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned editors to send messages
DROP POLICY IF EXISTS "Assigned editors can send messages" ON public.messages;
CREATE POLICY "Assigned editors can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.editors e ON e.id = p.editor_id
      WHERE p.id = messages.project_id
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to send messages
DROP POLICY IF EXISTS "Assigned clients can send messages" ON public.messages;
CREATE POLICY "Assigned clients can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = messages.project_id
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- ================== VIDEO VERSIONS ==================
DROP POLICY IF EXISTS "Users can view own video versions" ON public.video_versions;
CREATE POLICY "Users can view own video versions" ON public.video_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own video versions" ON public.video_versions;
CREATE POLICY "Users can manage own video versions" ON public.video_versions
  FOR ALL USING (created_by = auth.uid());

-- Allow assigned editors to view video versions
DROP POLICY IF EXISTS "Assigned editors can view video versions" ON public.video_versions;
CREATE POLICY "Assigned editors can view video versions" ON public.video_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.editors e ON e.id = p.editor_id
      WHERE p.id = video_versions.project_id
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to view video versions
DROP POLICY IF EXISTS "Assigned clients can view video versions" ON public.video_versions;
CREATE POLICY "Assigned clients can view video versions" ON public.video_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = video_versions.project_id
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned editors to add video versions
DROP POLICY IF EXISTS "Assigned editors can add video versions" ON public.video_versions;
CREATE POLICY "Assigned editors can add video versions" ON public.video_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.editors e ON e.id = p.editor_id
      WHERE p.id = video_versions.project_id
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to add video versions
DROP POLICY IF EXISTS "Assigned clients can add video versions" ON public.video_versions;
CREATE POLICY "Assigned clients can add video versions" ON public.video_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = video_versions.project_id
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- ================== VIDEO FEEDBACK ==================
DROP POLICY IF EXISTS "Project members can view feedback" ON public.video_feedback;
CREATE POLICY "Project members can view feedback" ON public.video_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.video_versions vv
      JOIN public.projects p ON p.id = vv.project_id
      WHERE vv.id = video_feedback.version_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert feedback" ON public.video_feedback;
CREATE POLICY "Users can insert feedback" ON public.video_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own feedback" ON public.video_feedback;
CREATE POLICY "Users can update own feedback" ON public.video_feedback
  FOR UPDATE USING (user_id = auth.uid());

-- Allow assigned editors to view feedback
DROP POLICY IF EXISTS "Assigned editors can view feedback" ON public.video_feedback;
CREATE POLICY "Assigned editors can view feedback" ON public.video_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.video_versions vv
      JOIN public.projects p ON p.id = vv.project_id
      JOIN public.editors e ON e.id = p.editor_id
      WHERE vv.id = video_feedback.version_id
      AND (e.user_id = auth.uid() OR LOWER(TRIM(e.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- Allow assigned clients to view feedback
DROP POLICY IF EXISTS "Assigned clients can view feedback" ON public.video_feedback;
CREATE POLICY "Assigned clients can view feedback" ON public.video_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.video_versions vv
      JOIN public.projects p ON p.id = vv.project_id
      JOIN public.clients c ON c.id = p.client_id
      WHERE vv.id = video_feedback.version_id
      AND (c.user_id = auth.uid() OR LOWER(TRIM(c.email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid()))))
    )
  );

-- ================== FEEDBACK ==================
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
CREATE POLICY "Users can manage own feedback" ON public.feedback
  FOR ALL USING (user_id = auth.uid());

-- ================== PROJECT TYPES ==================
DROP POLICY IF EXISTS "Users can view project types" ON public.project_types;
CREATE POLICY "Users can view project types" ON public.project_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own project types" ON public.project_types;
CREATE POLICY "Users can manage own project types" ON public.project_types
  FOR ALL USING (created_by = auth.uid());

-- ================== NOTIFICATIONS ==================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- ================== NOTIFICATION PREFERENCES ==================
DROP POLICY IF EXISTS "Users can view own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- ================== INVITATIONS (Accept/Deny) ==================
-- Users can view invitations they sent or received
DROP POLICY IF EXISTS "Users can view own invitations" ON public.invitations;
CREATE POLICY "Users can view own invitations" ON public.invitations
  FOR SELECT USING (
    inviter_id = auth.uid() OR 
    invitee_id = auth.uid() OR
    LOWER(TRIM(invitee_email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid())))
  );

-- Users can create invitations
DROP POLICY IF EXISTS "Users can create invitations" ON public.invitations;
CREATE POLICY "Users can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

-- Users can update invitations they received (to accept/reject)
DROP POLICY IF EXISTS "Users can update received invitations" ON public.invitations;
CREATE POLICY "Users can update received invitations" ON public.invitations
  FOR UPDATE USING (
    invitee_id = auth.uid() OR
    LOWER(TRIM(invitee_email)) = LOWER(TRIM((SELECT email FROM public.profiles WHERE id = auth.uid())))
  );

-- ================== PAYMENTS ==================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (user_id = auth.uid());

-- ================== INVOICES ==================
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own invoices" ON public.invoices;
CREATE POLICY "Users can manage own invoices" ON public.invoices
  FOR ALL USING (user_id = auth.uid());

-- ================== API KEYS ==================
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own api keys" ON public.api_keys;
CREATE POLICY "Users can manage own api keys" ON public.api_keys
  FOR ALL USING (user_id = auth.uid());

-- ================== ADMIN ACTIVITY LOGS ==================
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;
CREATE POLICY "Admins can view activity logs" ON public.admin_activity_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ================== SUBSCRIPTION PLANS ==================
DROP POLICY IF EXISTS "Users can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Users can view subscription plans" ON public.subscription_plans
  FOR SELECT USING (true);

-- ================== TRANSACTIONS ==================
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (editor_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions
  FOR ALL USING (editor_id = auth.uid());

-- ================== INVOICE PROJECTS ==================
DROP POLICY IF EXISTS "Users can view invoice projects for their invoices" ON public.invoice_projects;
CREATE POLICY "Users can view invoice projects for their invoices" ON public.invoice_projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_projects.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage invoice projects for their invoices" ON public.invoice_projects;
CREATE POLICY "Users can manage invoice projects for their invoices" ON public.invoice_projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_projects.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- ================== DATABASE CONFIG ==================
DROP POLICY IF EXISTS "Anyone can view database config" ON public.database_config;
CREATE POLICY "Anyone can view database config" ON public.database_config
  FOR SELECT USING (true);

-- ================== BROADCAST MESSAGES ==================
DROP POLICY IF EXISTS "Users can view broadcast messages" ON public.broadcast_messages;
CREATE POLICY "Users can view broadcast messages" ON public.broadcast_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage broadcast messages" ON public.broadcast_messages;
CREATE POLICY "Admins can manage broadcast messages" ON public.broadcast_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ================== AI CONVERSATIONS ==================
DROP POLICY IF EXISTS "Users can view own conversations" ON public.ai_conversations;
CREATE POLICY "Users can view own conversations" ON public.ai_conversations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own conversations" ON public.ai_conversations;
CREATE POLICY "Users can manage own conversations" ON public.ai_conversations
  FOR ALL USING (user_id = auth.uid());

-- ================== AI MESSAGES ==================
DROP POLICY IF EXISTS "Users can view messages of their conversations" ON public.ai_messages;
CREATE POLICY "Users can view messages of their conversations" ON public.ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.ai_messages;
CREATE POLICY "Users can insert messages to their conversations" ON public.ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete messages of their conversations" ON public.ai_messages;
CREATE POLICY "Users can delete messages of their conversations" ON public.ai_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

-- ================== EDITOR SHARES ==================
DROP POLICY IF EXISTS "Users can view editor shares for their editors" ON public.editor_shares;
CREATE POLICY "Users can view editor shares for their editors" ON public.editor_shares
  FOR SELECT USING (
    created_by = auth.uid() OR
    shared_with_user_id = auth.uid() OR
    shared_with_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create editor shares for their editors" ON public.editor_shares;
CREATE POLICY "Users can create editor shares for their editors" ON public.editor_shares
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.editors WHERE id = editor_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their editor shares" ON public.editor_shares;
CREATE POLICY "Users can delete their editor shares" ON public.editor_shares
  FOR DELETE USING (created_by = auth.uid());

-- ================== CLIENT SHARES ==================
DROP POLICY IF EXISTS "Users can view client shares for their clients" ON public.client_shares;
CREATE POLICY "Users can view client shares for their clients" ON public.client_shares
  FOR SELECT USING (
    created_by = auth.uid() OR
    shared_with_user_id = auth.uid() OR
    shared_with_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create client shares for their clients" ON public.client_shares;
CREATE POLICY "Users can create client shares for their clients" ON public.client_shares
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.clients WHERE id = client_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their client shares" ON public.client_shares;
CREATE POLICY "Users can delete their client shares" ON public.client_shares
  FOR DELETE USING (created_by = auth.uid());

-- ================== PROJECT SHARES ==================
DROP POLICY IF EXISTS "Users can view shares for their projects" ON public.project_shares;
CREATE POLICY "Users can view shares for their projects" ON public.project_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_shares.project_id
      AND projects.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create shares for their projects" ON public.project_shares;
CREATE POLICY "Users can create shares for their projects" ON public.project_shares
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update shares for their projects" ON public.project_shares;
CREATE POLICY "Users can update shares for their projects" ON public.project_shares
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_shares.project_id
      AND projects.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete shares for their projects" ON public.project_shares;
CREATE POLICY "Users can delete shares for their projects" ON public.project_shares
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_shares.project_id
      AND projects.created_by = auth.uid()
    )
  );

-- ================== PROJECT SHARE ACCESS LOGS ==================
DROP POLICY IF EXISTS "Users can view access logs for their project shares" ON public.project_share_access_logs;
CREATE POLICY "Users can view access logs for their project shares" ON public.project_share_access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_shares ps
      JOIN public.projects p ON p.id = ps.project_id
      WHERE ps.id = project_share_access_logs.share_id
      AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can insert access logs" ON public.project_share_access_logs;
CREATE POLICY "Public can insert access logs" ON public.project_share_access_logs
  FOR INSERT WITH CHECK (true);

-- ================== PROJECT CHAT MEMBERS ==================
DROP POLICY IF EXISTS "Users can view their own membership" ON public.project_chat_members;
CREATE POLICY "Users can view their own membership" ON public.project_chat_members
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Project creators can view all members" ON public.project_chat_members;
CREATE POLICY "Project creators can view all members" ON public.project_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_chat_members.project_id
      AND projects.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Active members can view other members" ON public.project_chat_members;
CREATE POLICY "Active members can view other members" ON public.project_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_chat_members AS pcm
      WHERE pcm.project_id = project_chat_members.project_id
      AND pcm.user_id = auth.uid()
      AND pcm.is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can request to join" ON public.project_chat_members;
CREATE POLICY "Users can request to join" ON public.project_chat_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Project creators can manage members" ON public.project_chat_members;
CREATE POLICY "Project creators can manage members" ON public.project_chat_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_chat_members.project_id
      AND projects.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Project creators can remove members" ON public.project_chat_members;
CREATE POLICY "Project creators can remove members" ON public.project_chat_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_chat_members.project_id
      AND projects.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can leave chat" ON public.project_chat_members;
CREATE POLICY "Users can leave chat" ON public.project_chat_members
  FOR DELETE USING (auth.uid() = user_id);

-- ================== USER ACCESSED SHARES ==================
DROP POLICY IF EXISTS "Users can view own accessed shares" ON public.user_accessed_shares;
CREATE POLICY "Users can view own accessed shares" ON public.user_accessed_shares
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accessed shares" ON public.user_accessed_shares;
CREATE POLICY "Users can insert own accessed shares" ON public.user_accessed_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accessed shares" ON public.user_accessed_shares;
CREATE POLICY "Users can update own accessed shares" ON public.user_accessed_shares
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accessed shares" ON public.user_accessed_shares;
CREATE POLICY "Users can delete own accessed shares" ON public.user_accessed_shares
  FOR DELETE USING (auth.uid() = user_id);

-- ================== NOTES ==================
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes" ON public.notes
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view notes of projects they created" ON public.notes;
CREATE POLICY "Users can view notes of projects they created" ON public.notes
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view notes of projects they are editor of" ON public.notes;
CREATE POLICY "Users can view notes of projects they are editor of" ON public.notes
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM public.projects WHERE editor_id IN (SELECT id FROM public.editors WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view notes of projects they are client of" ON public.notes;
CREATE POLICY "Users can view notes of projects they are client of" ON public.notes
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "Users can insert their own notes" ON public.notes
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes" ON public.notes
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes" ON public.notes
  FOR DELETE USING (created_by = auth.uid());

-- ================== APP SETTINGS ==================
DROP POLICY IF EXISTS "Allow read access to app_settings" ON public.app_settings;
CREATE POLICY "Allow read access to app_settings" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can insert app_settings" ON public.app_settings;
CREATE POLICY "Admin can insert app_settings" ON public.app_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can update app_settings" ON public.app_settings;
CREATE POLICY "Admin can update app_settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

-- ================== USER SUBSCRIPTIONS ==================
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can insert own subscriptions" ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admin can view all subscriptions" ON public.user_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

-- ================== ADVANCES ==================
DROP POLICY IF EXISTS "Users can view own advances" ON public.advances;
CREATE POLICY "Users can view own advances" ON public.advances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own advances" ON public.advances;
CREATE POLICY "Users can insert own advances" ON public.advances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own advances" ON public.advances;
CREATE POLICY "Users can update own advances" ON public.advances
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own advances" ON public.advances;
CREATE POLICY "Users can delete own advances" ON public.advances
  FOR DELETE USING (auth.uid() = user_id AND is_deducted = false);

-- ================== SUBSCRIPTION PLANS ADMIN ==================
DROP POLICY IF EXISTS "Admin can insert subscription_plans" ON public.subscription_plans;
CREATE POLICY "Admin can insert subscription_plans" ON public.subscription_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can update subscription_plans" ON public.subscription_plans;
CREATE POLICY "Admin can update subscription_plans" ON public.subscription_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

DROP POLICY IF EXISTS "Admin can delete subscription_plans" ON public.subscription_plans;
CREATE POLICY "Admin can delete subscription_plans" ON public.subscription_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email IN ('admin@xrozen.com', 'kiranbanna12@gmail.com', 'kiranjeetsekhon07@gmail.com')
    )
  );

-- =====================================================
-- 10. INDEXES FOR PERFORMANCE
-- =====================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_category ON public.profiles(user_category);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Editors indexes (important for bidirectional queries)
CREATE INDEX IF NOT EXISTS idx_editors_email ON public.editors(email);
CREATE INDEX IF NOT EXISTS idx_editors_email_lower ON public.editors(LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_editors_created_by ON public.editors(created_by);
CREATE INDEX IF NOT EXISTS idx_editors_user_id ON public.editors(user_id);

-- Clients indexes (important for bidirectional queries)
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_email_lower ON public.clients(LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_editor_id ON public.projects(editor_id);

-- Project clients indexes
CREATE INDEX IF NOT EXISTS idx_project_clients_project_id ON public.project_clients(project_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_client_id ON public.project_clients(client_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON public.messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Video versions indexes
CREATE INDEX IF NOT EXISTS idx_video_versions_project_id ON public.video_versions(project_id);

-- Video feedback indexes
CREATE INDEX IF NOT EXISTS idx_video_feedback_version_id ON public.video_feedback(version_id);
CREATE INDEX IF NOT EXISTS idx_video_feedback_user_id ON public.video_feedback(user_id);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON public.feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_version_id ON public.feedback(version_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_email ON public.invitations(LOWER(TRIM(invitee_email)));
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON public.invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_editor_id ON public.transactions(editor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);

-- Invoice projects indexes
CREATE INDEX IF NOT EXISTS idx_invoice_projects_invoice_id ON public.invoice_projects(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_projects_project_id ON public.invoice_projects(project_id);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

-- AI conversations indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);

-- AI messages indexes
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);

-- Editor shares indexes
CREATE INDEX IF NOT EXISTS idx_editor_shares_editor_id ON public.editor_shares(editor_id);
CREATE INDEX IF NOT EXISTS idx_editor_shares_shared_with_email ON public.editor_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_editor_shares_created_by ON public.editor_shares(created_by);

-- Client shares indexes
CREATE INDEX IF NOT EXISTS idx_client_shares_client_id ON public.client_shares(client_id);
CREATE INDEX IF NOT EXISTS idx_client_shares_shared_with_email ON public.client_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_client_shares_created_by ON public.client_shares(created_by);

-- Broadcast messages indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_sent_by ON public.broadcast_messages(sent_by);

-- Project shares indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON public.project_shares(share_token);

-- Project share access logs indexes
CREATE INDEX IF NOT EXISTS idx_project_share_access_logs_share_id ON public.project_share_access_logs(share_id);

-- Project chat members indexes
CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON public.project_chat_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON public.project_chat_members(user_id);

-- User accessed shares indexes
CREATE INDEX IF NOT EXISTS idx_user_accessed_shares_user_id ON public.user_accessed_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_user_accessed_shares_project_id ON public.user_accessed_shares(project_id);

-- Notes indexes
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes(created_by);

-- User subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

-- Advances indexes
CREATE INDEX IF NOT EXISTS idx_advances_user_id ON public.advances(user_id);
CREATE INDEX IF NOT EXISTS idx_advances_recipient ON public.advances(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_advances_is_deducted ON public.advances(is_deducted);

-- Messages additional indexes
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON public.messages(updated_at);

-- =====================================================
-- 11. SEED DATA
-- =====================================================

-- Insert default email configuration
INSERT INTO public.email_configurations (from_name, from_email, is_active)
VALUES ('App Notifications', 'noreply@example.com', true)
ON CONFLICT DO NOTHING;

-- Insert default razorpay_config setting
INSERT INTO public.app_settings (key, value)
VALUES ('razorpay_config', '{"key_id": "", "key_secret": ""}')
ON CONFLICT (key) DO NOTHING;

-- Insert email templates
INSERT INTO public.email_templates (name, subject, body_html, body_text)
VALUES
  ('project-created', 'New Project: {projectName}', '<h1>New Project Created</h1><p>A new project <strong>{projectName}</strong> has been created.</p><p><a href="{link}">View Project</a></p>', 'A new project {projectName} has been created. View at {link}'),
  ('project-assigned', 'Project Assigned: {projectName}', '<h1>Project Assigned</h1><p>You have been assigned to the project <strong>{projectName}</strong>.</p><p><a href="{link}">View Project</a></p>', 'You have been assigned to the project {projectName}. View at {link}'),
  ('project-status-changed', 'Status Changed: {projectName}', '<h1>Project Status Changed</h1><p>The status of project <strong>{projectName}</strong> has changed to <strong>{newStatus}</strong>.</p><p><a href="{link}">View Project</a></p>', 'The status of project {projectName} has changed to {newStatus}. View at {link}'),
  ('version-added', 'New Version: {projectName}', '<h1>New Version Added</h1><p>Version {versionNumber} has been added to project <strong>{projectName}</strong>.</p><p><a href="{link}">View Version</a></p>', 'Version {versionNumber} has been added to project {projectName}. View at {link}'),
  ('deadline-approaching', 'Deadline Approaching: {projectName}', '<h1>Deadline Approaching</h1><p>The deadline for project <strong>{projectName}</strong> is approaching (Due: {deadline}).</p><p><a href="{link}">View Project</a></p>', 'The deadline for project {projectName} is approaching (Due: {deadline}). View at {link}'),
  ('deadline-overdue', 'OVERDUE: {projectName}', '<h1>Project Overdue</h1><p>The project <strong>{projectName}</strong> is overdue!</p><p><a href="{link}">View Project</a></p>', 'The project {projectName} is overdue! View at {link}'),
  ('feedback-added', 'New Feedback: {projectName}', '<h1>New Feedback</h1><p>New feedback has been added to project <strong>{projectName}</strong>.</p><p>"{feedbackPreview}"</p><p><a href="{link}">View Feedback</a></p>', 'New feedback has been added to project {projectName}. View at {link}'),
  ('correction-requested', 'Correction Requested: {projectName}', '<h1>Correction Requested</h1><p>Corrections have been requested for project <strong>{projectName}</strong>.</p><p><a href="{link}">View Details</a></p>', 'Corrections have been requested for project {projectName}. View at {link}'),
  ('project-approved', 'Project Approved: {projectName}', '<h1>Project Approved</h1><p>Project <strong>{projectName}</strong> has been approved!</p><p><a href="{link}">View Project</a></p>', 'Project {projectName} has been approved! View at {link}'),
  ('invoice-generated', 'New Invoice: {amount}', '<h1>Invoice Generated</h1><p>A new invoice for <strong>${amount}</strong> has been generated.</p><p><a href="{link}">View Invoice</a></p>', 'A new invoice for ${amount} has been generated. View at {link}'),
  ('invoice-due', 'Invoice Due: {amount}', '<h1>Invoice Due</h1><p>Invoice for <strong>${amount}</strong> is due soon.</p><p><a href="{link}">View Invoice</a></p>', 'Invoice for ${amount} is due soon. View at {link}'),
  ('payment-received', 'Payment Received: {amount}', '<h1>Payment Received</h1><p>We received a payment of <strong>${amount}</strong>.</p><p><a href="{link}">View Invoice</a></p>', 'We received a payment of ${amount}. View at {link}'),
  ('chat-message', 'New Message from {senderName}', '<h1>New Message</h1><p>You have a new message from <strong>{senderName}</strong>.</p><p>"{messagePreview}"</p><p><a href="{link}">View Message</a></p>', 'You have a new message from {senderName}. "{messagePreview}" View at {link}')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 12. ENABLE REALTIME (Optional - uncomment if needed)
-- =====================================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- =====================================================
-- END OF COMPLETE DATABASE SETUP
-- =====================================================
--
-- BIDIRECTIONAL RELATIONSHIP SUMMARY:
-- =================================
-- 
-- TABLE: editors
-- - created_by: Who added this editor
-- - email: Editor's email
-- - user_id: Link to profiles if user exists
--
-- TABLE: clients  
-- - created_by: Who added this client
-- - email: Client's email
-- - user_id: Link to profiles if user exists
--
-- HOW IT WORKS:
-- 1. User1 adds User2's email in EDITORS table
-- 2. User2 logs in and their email matches an entry in EDITORS
-- 3. User2 can now see User1 in their CLIENTS page (they see who added them as editor)
-- 4. Vice versa: If User1 adds User2 in CLIENTS, User2 sees User1 in EDITORS
--
-- RLS POLICY LOGIC:
-- SELECT allowed if: created_by = me OR my email matches OR user_id = me
-- INSERT/UPDATE/DELETE allowed only if: created_by = me
--
-- =====================================================
-