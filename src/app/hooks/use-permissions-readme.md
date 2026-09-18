## Permission Conditions

The system supports various permission conditions:

- **`role-based`** - Simple role checking
- **`creator-match`** - User must be the creator (or admin/owner)
- **`admin-ids-match`** - User ID must be in admin list (or admin/owner)
- **`user-id-match`** - User ID must match owner ID
- **`admin-or-creator`** - User is admin, owner, creator, or in admin list
- **`public`** - Public access allowed
- **`always-allow`** - Always permitted
- **`owner-only`** - Only owners allowed
- **`custom`** - Custom validation function

### Supported Roles

```typescript
type Role = 'owner' | 'admin' | 'developer' | 'user';
```

**Roles Description** :

1. `owner` - Full system access
2. `admin` - Administrative privileges
3. `developer` - Development and configuration access
4. `user` - Basic user privileges

## Basic Usage

### Using the Hook

```typescript
import usePermissions from './hooks/usePermissions';

const MyComponent = () => {
  const {
    canAccessible,
    userRole,
    hasAdminPrivileges,
    sideNavRolePermissions
  } = usePermissions();

  // Check if user can perform an action
  const canEdit = canAccessible('agents', 'put');

  return (
    <div>
      <p>User Role: {userRole}</p>
      <p>Has Admin Access: {hasAdminPrivileges ? 'Yes' : 'No'}</p>
      {canEdit && <button>Edit Agent</button>}
    </div>
  );
};
```

## API Reference

### `usePermissions()` Hook

Returns an object with the following properties and methods:

#### Properties

- `userRole: Role` - Current user's role
- `userId: string` - Current user's ID
- `hasAdminPrivileges: boolean` - Whether user has admin-level access
- `sideNavRolePermissions: Module[]` - Modules accessible in navigation
- `defaultNavItem: Module` - First accessible navigation item

#### Methods

##### `canAccessible(module, action, resourceContext?, noConditionCheck?)`

Check if user can perform an action on a module.

```typescript
// Basic permission check
const canView = canAccessible('agents', 'get');

// With resource context
const canDelete = canAccessible('agents', 'delete', {
    creatorId: 'user123',
    adminIds: ['admin1', 'admin2'],
});

// Skip condition checking (for UI permissions) : generally user has permission for particular module
const hasRole = canAccessible('users', 'post', undefined, true);
```

## Examples

### 1. Basic Permission Checking

```typescript
 * Example demonstrating the enhanced permissions system usage

     // Example 1: Simple role-based permission check (legacy compatibility)
     const canViewUsers = canAccessible('users', 'get');

     // Example 2: Check if user can delete a resource they created
     const canDeleteOwnModel = canAccessible('models', 'delete', {
         creatorId: 'user123', // This would come from the Model resource
     });

     // Example 3: Check if user can access an agent with adminIds
     const canAccessAgent = canAccessible('agents', 'delete', {
         adminIds: ['user123', 'user456'], // Users who have admin access to this agent
     });

     // Example 4: Check if user can access their own conversation
     const canViewOwnConversation = canAccessible('conversations', 'get', {
         ownerId: 'currentUserId', // The user who owns the conversation
     });

     // Example 5: Check if user can access public content
     const canViewPublicContent = canAccessible('public', 'get', {
         isPublic: true,
     });
```

```typescript
const UserManagement = () => {
  const { canAccessible, userRole } = usePermissions();

  const canCreateUser = canAccessible('users', 'post');
  const canDeleteUser = canAccessible('users', 'delete');
  const canViewUsers = canAccessible('users', 'get');

  if (!canViewUsers) {
    return <div>Access denied</div>;
  }

  return (
    <div>
      <h2>User Management</h2>
      <UserList />

      {canCreateUser && (
        <button onClick={() => createUser()}>
          Create New User
        </button>
      )}

      {canDeleteUser && (
        <button onClick={() => deleteUser()}>
          Delete User
        </button>
      )}
    </div>
  );
};
```

### 2. Resource-Specific Permissions

```typescript
const AgentCard = ({ agent }) => {
  const { canAccessible } = usePermissions();

  // Check if user can edit this specific agent
  const canEdit = canAccessible('agents', 'put', {
    creatorId: agent.createdBy,
    adminIds: agent.adminIds
  });

  // Check if user can delete this agent
  const canDelete = canAccessible('agents', 'delete', {
    adminIds: agent.adminIds
  });

  return (
    <div className="agent-card">
      <h3>{agent.name}</h3>
      <p>Created by: {agent.createdBy}</p>

      <div className="actions">
        {canEdit && (
          <button onClick={() => editAgent(agent.id)}>
            Edit
          </button>
        )}

        {canDelete && (
          <button onClick={() => deleteAgent(agent.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
```

### 3. Admin Panel Access

```typescript
const AdminPanel = () => {
  const { hasAdminPrivileges, canAccessible } = usePermissions();

  if (!hasAdminPrivileges) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>
    </div>
  );
};
```

### 4. Using Permission Guard Component

```typescript
import { PermissionGuard } from './hooks/usePermissions';

const ProtectedContent = () => (
  <PermissionGuard
    module="users"
    action="delete"
    fallback={<p>You don't have permission to delete users</p>}
  >
    <button className="danger">Delete User</button>
  </PermissionGuard>
);
```

### 5. Using HIGHER-ORDER COMPONENT (HOC) PATTERN for making normal Components into Protected Components

```typescript
const DeleteButton = ({ onClick, className }: {
    onClick: () => void;
    className?: string;
}) => (
    <button onClick={onClick} className={className}>
        Delete User
    </button>
);

const ProtectedDeleteButton = withPermissions(
    DeleteButton,     // Original component
    'users',         // Module to check
    'delete'         // Action to check
);

// How the HOC works step by step
/*
1. withPermissions() is called with DeleteButton, 'users', 'delete'
2. It returns a NEW component function
3. When <ProtectedDeleteButton /> is rendered:
   - The new component function runs
   - It checks canAccessible('users', 'delete')
   - If true: renders <DeleteButton {...props} />
   - If false: renders null (nothing)
*/

//  Using the protected component
const UserManagement = () => {
    const handleDelete = () => console.log('Deleting user...');

    return (
        <div>
            <h2>User Management</h2>
            {/* This will only render if user has 'users'/'delete' permission */}
            <ProtectedDeleteButton
                onClick={handleDelete}
                className="danger-btn"
            />
        </div>
    );
};
```

### 6. Multiple Permissions

```typescript
// ✅ Good: Batch permission checks
const permissions = checkMultiplePermissions([...]);

// ❌ Avoid: Multiple individual checks
const canEdit = canAccessible('agents', 'put');
const canDelete = canAccessible('agents', 'delete');
const canView = canAccessible('agents', 'get');
```
