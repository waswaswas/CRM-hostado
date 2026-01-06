'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Crown, Shield, UserCog, Eye } from 'lucide-react'
import type { Organization, OrganizationMember } from '@/types/database'

interface OrganizationMembersListProps {
  organization: Organization
  initialMembers: OrganizationMember[]
  userRole: 'owner' | 'admin' | 'moderator' | 'viewer' | null
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  moderator: UserCog,
  viewer: Eye,
}

const roleColors = {
  owner: 'text-yellow-600 dark:text-yellow-400',
  admin: 'text-blue-600 dark:text-blue-400',
  moderator: 'text-purple-600 dark:text-purple-400',
  viewer: 'text-gray-600 dark:text-gray-400',
}

export function OrganizationMembersList({
  organization,
  initialMembers,
  userRole,
}: OrganizationMembersListProps) {
  const [members] = useState(initialMembers)
  const canManage = userRole === 'owner' || userRole === 'admin'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Members</CardTitle>
          </div>
          {canManage && (
            <Button size="sm" disabled>
              Invite Member
            </Button>
          )}
        </div>
        <CardDescription>
          {members.length} member{members.length !== 1 ? 's' : ''} in this organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {members.map((member) => {
            const Icon = roleIcons[member.role]
            const colorClass = roleColors[member.role]
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${colorClass}`} />
                  <div>
                    <div className="font-medium">
                      {member.user_email || 'Unknown User'}
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {member.role}
                    </div>
                  </div>
                </div>
                {canManage && member.role !== 'owner' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

