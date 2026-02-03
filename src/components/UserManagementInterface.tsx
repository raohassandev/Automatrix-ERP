"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCheck, Shield, AlertCircle } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  roleName: string;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
}

interface UserManagementInterfaceProps {
  users: User[];
  roles: Role[];
}

export function UserManagementInterface({ users, roles }: UserManagementInterfaceProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const handleRoleChange = async () => {
    if (!selectedUser || !selectedRole) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedUser.email,
          roleName: selectedRole
        })
      });

      if (response.ok) {
        setLastUpdate(`Updated ${selectedUser.name} to ${selectedRole} role`);
        setSelectedUser(null);
        setSelectedRole("");
        router.refresh();
      } else {
        const error = await response.json();
        setLastUpdate(`Error: ${error.error || 'Failed to update role'}`);
      }
    } catch (error) {
      setLastUpdate('Error: Network error occurred');
      console.error('Error updating user role:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleDescription = (roleName: string) => {
    switch (roleName) {
      case 'CEO':
      case 'Owner':
        return 'Full system access and administrative privileges';
      case 'Admin':
        return 'System administration with broad operational access';
      case 'CFO':
        return 'Executive finance oversight, approvals, and reporting';
      case 'Accountant':
        return 'Accounting operations, invoicing, and wallet management';
      case 'Finance Manager':
        return 'Financial oversight, approvals, and reporting access';
      case 'Manager':
        return 'Team management and limited approval authority';
      case 'Marketing':
        return 'Client and project visibility with updates to sales pipeline';
      case 'Sales':
        return 'Client and quotation visibility with invoice access';
      case 'Engineering':
        return 'Project execution with expense submission and inventory requests';
      case 'HR':
        return 'Employee visibility and team reporting';
      case 'Procurement':
        return 'Purchasing, inventory requests, and expense submissions';
      case 'Staff':
        return 'Basic access to own records and assigned projects';
      case 'Guest':
        return 'View-only dashboard access';
      default:
        return 'Unknown role permissions';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Assignment
          </CardTitle>
          <CardDescription>
            Assign or change user roles to control system access and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label>Select User</Label>
            <Select 
              value={selectedUser?.id || ""} 
              onValueChange={(userId) => {
                const user = users.find(u => u.id === userId) || null;
                setSelectedUser(user);
                setSelectedRole(user?.roleName || "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a user to modify" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {user.email} • Current: {user.roleName}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role Selection */}
          {selectedUser && (
            <div className="space-y-2">
              <Label>Assign New Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.name}</span>
                          {role.name === selectedUser.roleName && (
                            <Badge variant="outline">Current</Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {getRoleDescription(role.name)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current Selection Summary */}
          {selectedUser && selectedRole && selectedRole !== selectedUser.roleName && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900">
                      Role Change Summary
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>{selectedUser.name}</strong> ({selectedUser.email}) will be changed from{" "}
                      <strong>{selectedUser.roleName}</strong> to <strong>{selectedRole}</strong>
                    </p>
                    <p className="text-xs text-blue-600">
                      {getRoleDescription(selectedRole)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              onClick={handleRoleChange}
              disabled={!selectedUser || !selectedRole || selectedRole === selectedUser?.roleName || isUpdating}
              className="flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              {isUpdating ? 'Updating...' : 'Update Role'}
            </Button>
            
            {(selectedUser || selectedRole) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setSelectedUser(null);
                  setSelectedRole("");
                }}
                disabled={isUpdating}
              >
                Clear Selection
              </Button>
            )}
          </div>

          {/* Last Update Status */}
          {lastUpdate && (
            <div className={`p-3 rounded-lg text-sm ${
              lastUpdate.startsWith('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {lastUpdate}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions Reference</CardTitle>
          <CardDescription>
            Understanding what each role can access in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{role.name}</h3>
                  <Badge variant={
                    role.name === 'CEO' || role.name === 'Owner' ? 'default' :
                    role.name === 'CFO' || role.name === 'Finance Manager' ? 'secondary' :
                    role.name === 'Manager' ? 'outline' :
                    role.name === 'Staff' ? 'outline' : 'destructive'
                  }>
                    {users.filter(u => u.roleName === role.name).length} users
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getRoleDescription(role.name)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
