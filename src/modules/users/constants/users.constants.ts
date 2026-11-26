export const USERS_ROUTE = 'users';
export const ADMIN_USERS_ROUTE = 'admin/users';
export const USERS_API_TAG = 'Users';
export const ADMIN_USERS_API_TAG = 'Admin - Users';

export const USER_ERRORS = {
  EMAIL_TAKEN: 'Email is already registered',
  NOT_FOUND: 'User not found',
  CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role',
  CANNOT_DEACTIVATE_SELF: 'You cannot deactivate your own account',
  SUPER_ADMIN_PROTECTED: 'Only a Super Admin can modify a Super Admin account',
  HIERARCHY_ROLE_LOCKED: 'Super Admin, Master and Client roles are managed through the hierarchy APIs and cannot be changed here',
  MASTER_NOT_FOUND: 'Master not found',
  CLIENT_NOT_FOUND: 'Client not found',
} as const;

export const USER_MESSAGES = {
  PROFILE_FETCHED: 'Profile fetched successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  LISTED: 'Users fetched successfully',
  FETCHED: 'User fetched successfully',
  UPDATED: 'User updated successfully',
  ACTIVATED: 'User activated successfully',
  DEACTIVATED: 'User deactivated successfully',
} as const;

export const USER_NAME_MIN_LENGTH = 2;
export const USER_NAME_MAX_LENGTH = 100;
export const USER_EMAIL_MAX_LENGTH = 254;
