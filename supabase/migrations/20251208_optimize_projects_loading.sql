-- =====================================================
-- Migration: Optimize Projects Page Loading
-- Created: 2025-12-08
-- Description: Creates RPC function to load all projects page data in a single call
-- =====================================================

-- Function to get all projects page data for a user in one call
CREATE OR REPLACE FUNCTION public.get_user_projects_page_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
    projects_arr JSON;
    editors_arr JSON;
    clients_arr JSON;
    result JSON;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;
    
    -- Get user email
    SELECT LOWER(TRIM(email)) INTO user_email 
    FROM profiles 
    WHERE id = current_user_id;
    
    -- 1. Get ALL projects for the user (created, assigned as editor, assigned as client, shared)
    SELECT COALESCE(json_agg(p ORDER BY p.created_at DESC), '[]'::json) INTO projects_arr
    FROM (
        -- Projects I created
        SELECT *, false as is_assigned, false as is_shared FROM projects WHERE created_by = current_user_id
        
        UNION
        
        -- Projects assigned to me as editor
        SELECT p.*, true as is_assigned, false as is_shared 
        FROM projects p
        JOIN editors e ON p.editor_id = e.id
        WHERE p.created_by != current_user_id
          AND (e.user_id = current_user_id OR LOWER(TRIM(e.email)) = user_email)
        
        UNION
        
        -- Projects assigned to me as client
        SELECT p.*, true as is_assigned, false as is_shared 
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        WHERE p.created_by != current_user_id
          AND (c.user_id = current_user_id OR LOWER(TRIM(c.email)) = user_email)
        
        UNION
        
        -- Projects shared with me (via share links with edit/chat permission)
        SELECT p.*, false as is_assigned, true as is_shared
        FROM projects p
        JOIN user_accessed_shares uas ON uas.project_id = p.id
        JOIN project_shares ps ON ps.id = uas.share_id
        WHERE uas.user_id = current_user_id
          AND ps.is_active = true
          AND (ps.can_edit = true OR ps.can_chat = true)
          AND p.created_by != current_user_id
    ) p;
    
    -- 2. Get editors (my editors + linked editors from clients entries)
    SELECT COALESCE(json_agg(e ORDER BY e.created_at DESC), '[]'::json) INTO editors_arr
    FROM (
        -- My editors
        SELECT id, user_id, full_name, email, specialty, employment_type, hourly_rate, monthly_salary, created_at, false as is_linked
        FROM editors 
        WHERE created_by = current_user_id
        
        UNION
        
        -- Linked editors (I appear in someone's clients, so their profile becomes my "editor")
        SELECT 
            'linked-' || c.id as id,
            pr.id as user_id,
            pr.full_name,
            pr.email,
            'Linked Editor' as specialty,
            c.employment_type,
            NULL as hourly_rate,
            NULL as monthly_salary,
            c.created_at,
            true as is_linked
        FROM clients c
        JOIN profiles pr ON pr.id = c.created_by
        WHERE c.created_by != current_user_id
          AND (c.user_id = current_user_id OR LOWER(TRIM(c.email)) = user_email)
    ) e;
    
    -- 3. Get clients (my clients + linked clients from editors entries)
    SELECT COALESCE(json_agg(c ORDER BY c.created_at DESC), '[]'::json) INTO clients_arr
    FROM (
        -- My clients
        SELECT id, user_id, full_name, email, company, employment_type, created_at, false as is_linked
        FROM clients 
        WHERE created_by = current_user_id
        
        UNION
        
        -- Linked clients (I appear in someone's editors, so their profile becomes my "client")
        SELECT 
            'linked-' || e.id as id,
            pr.id as user_id,
            pr.full_name,
            pr.email,
            'Linked Client' as company,
            e.employment_type,
            e.created_at,
            true as is_linked
        FROM editors e
        JOIN profiles pr ON pr.id = e.created_by
        WHERE e.created_by != current_user_id
          AND (e.user_id = current_user_id OR LOWER(TRIM(e.email)) = user_email)
    ) c;
    
    -- 4. Construct result
    result := json_build_object(
        'projects', projects_arr,
        'editors', editors_arr,
        'clients', clients_arr
    );
    
    RETURN result;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_projects_page_data() IS 'Returns all projects, editors, and clients for a user in a single optimized call for the Projects page';
