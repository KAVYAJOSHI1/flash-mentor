
import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface FlashContextType {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    triggerMessage: (message: string) => void;
    messageQueue: string[];
    clearMessageQueue: () => void;
}

const FlashContext = createContext<FlashContextType | undefined>(undefined);

export const FlashProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messageQueue, setMessageQueue] = useState<string[]>([]);

    const triggerMessage = (message: string) => {
        setIsOpen(true);
        setMessageQueue(prev => [...prev, message]);
    };

    const clearMessageQueue = () => {
        setMessageQueue([]);
    };

    return (
        <FlashContext.Provider value={{ isOpen, setIsOpen, triggerMessage, messageQueue, clearMessageQueue }}>
            {children}
        </FlashContext.Provider>
    );
};

export const useFlash = () => {
    const context = useContext(FlashContext);
    if (context === undefined) {
        throw new Error('useFlash must be used within a FlashProvider');
    }
    return context;
};
