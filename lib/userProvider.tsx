'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
// Tipos de planos comuns




export interface IUserContextType {
    updatedAt: Date;
    tokenVar: string | undefined;
    createdAt: Date;
}

const UserContext = createContext<IUserContextType | undefined>(undefined);

export function UserProvider({ children, tokenVar }: { children: ReactNode, tokenVar: string | undefined }) {
    // Aqui você poderia inicializar com dados vindos de um fetch/API
    const [token, {/*setToken*/ }] = useState<string | undefined>(tokenVar);

    return (
        <UserContext.Provider value={{ tokenVar: token || undefined, createdAt: new Date(), updatedAt: new Date() }
        }>
            {children}
        </UserContext.Provider>
    );
}

export function useUserContext() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserContext must be used within a UserProvider');
    }
    return context;
}