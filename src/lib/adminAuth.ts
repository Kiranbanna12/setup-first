/**
 * Admin authentication and authorization utilities
 * Manages admin access control using local admin.json file
 */

import adminsData from '@/data/admins.json';

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminsData.admins.includes(email.toLowerCase());
}

/**
 * Get list of all admin emails
 */
export function getAdminEmails(): string[] {
  return [...adminsData.admins];
}
