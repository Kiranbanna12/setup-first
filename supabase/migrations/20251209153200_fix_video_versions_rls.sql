CREATE POLICY "Project owners can add video versions"
ON "public"."video_versions"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.id = video_versions.project_id
      AND projects.created_by = auth.uid()
  )
);
