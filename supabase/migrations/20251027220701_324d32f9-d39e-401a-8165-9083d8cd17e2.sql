-- Fix infinite recursion in user_roles RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Create new policy using the has_role function which is SECURITY DEFINER
CREATE POLICY "Admins can manage all roles"
ON user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));
