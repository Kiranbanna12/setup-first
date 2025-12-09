-- RPC function to load all project details data in a single call
CREATE OR REPLACE FUNCTION public.get_project_details_data(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_project projects%ROWTYPE;
  v_editor editors%ROWTYPE;
  v_client clients%ROWTYPE;
BEGIN
  -- Get project data
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  
  IF v_project.id IS NULL THEN
    RETURN json_build_object('error', 'Project not found');
  END IF;

  -- Get editor if assigned
  IF v_project.editor_id IS NOT NULL THEN
    SELECT * INTO v_editor FROM editors WHERE id = v_project.editor_id;
  END IF;

  -- Get client if assigned
  IF v_project.client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM clients WHERE id = v_project.client_id;
  END IF;

  -- Build complete result with all data in parallel queries
  SELECT json_build_object(
    'project', row_to_json(v_project),
    'editor', CASE WHEN v_editor.id IS NOT NULL THEN row_to_json(v_editor) ELSE NULL END,
    'client', CASE WHEN v_client.id IS NOT NULL THEN row_to_json(v_client) ELSE NULL END,
    'versions', COALESCE((
      SELECT json_agg(vv ORDER BY vv.version_number DESC)
      FROM video_versions vv
      WHERE vv.project_id = p_project_id
    ), '[]'::json),
    'sub_projects', COALESCE((
      SELECT json_agg(sp)
      FROM projects sp
      WHERE sp.parent_project_id = p_project_id
    ), '[]'::json),
    'sub_project_versions', COALESCE((
      SELECT json_object_agg(
        sp.id,
        COALESCE((
          SELECT json_agg(vv ORDER BY vv.version_number DESC)
          FROM video_versions vv
          WHERE vv.project_id = sp.id
        ), '[]'::json)
      )
      FROM projects sp
      WHERE sp.parent_project_id = p_project_id
    ), '{}'::json),
    'user_role', (
      SELECT role FROM user_roles WHERE user_id = p_user_id LIMIT 1
    ),
    'my_editor_ids', COALESCE((
      SELECT json_agg(e.id)
      FROM editors e
      WHERE e.user_id = p_user_id
    ), '[]'::json),
    'my_client_ids', COALESCE((
      SELECT json_agg(c.id)
      FROM clients c
      WHERE c.user_id = p_user_id
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_project_details_data(UUID, UUID) TO authenticated;
