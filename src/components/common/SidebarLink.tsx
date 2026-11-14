import { useAuth } from '@/src/contexts/AuthContext';
import React from 'react'
import { NavLink } from 'react-router-dom'

interface SidebarLinkProps {
    to: string;
    children: React.ReactNode;
    allowedRoles?: string[];
    id?: string;
    className?: string;
}

export default function SidebarLink({ to, children, allowedRoles, id, className }: SidebarLinkProps) {
    const { user } = useAuth();

    if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
        return null;
    }

    return (
        <NavLink
            id={id}
            to={to}
            className={({ isActive }) => [isActive ? 'active' : '', className].filter(Boolean).join(' ')}
        >
            {children}
        </NavLink>
    );
}
