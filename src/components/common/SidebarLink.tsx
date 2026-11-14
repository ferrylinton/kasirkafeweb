import { useAuth } from '@/src/contexts/AuthContext';
import React from 'react'
import { NavLink } from 'react-router-dom'

interface SidebarLinkProps {
    to: string;
    children: React.ReactNode;
    allowedRoles?: string[];
}


export default function SidebarLink({ to, children, allowedRoles }: SidebarLinkProps) {
    const { user } = useAuth();

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return null;
    }

    return (
        <NavLink to={to} className={({ isActive }) => `${isActive ? 'active' : ''}`}>
            {children}
        </NavLink>
    )
}
