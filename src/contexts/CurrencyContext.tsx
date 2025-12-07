import React, { createContext, useContext, useState } from 'react';

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyInfo {
    code: Currency;
    symbol: string;
    name: string;
    flag: string;
    conversionRate: number; // Rate relative to INR
}

export const currencies: Record<Currency, CurrencyInfo> = {
    INR: {
        code: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
        flag: '🇮🇳',
        conversionRate: 1,
    },
    USD: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        flag: '🇺🇸',
        conversionRate: 0.012, // 1 INR = 0.012 USD (approx)
    },
    EUR: {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        flag: '🇪🇺',
        conversionRate: 0.011, // 1 INR = 0.011 EUR (approx)
    },
    GBP: {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound',
        flag: '🇬🇧',
        conversionRate: 0.0095, // 1 INR = 0.0095 GBP (approx)
    },
};

interface CurrencyContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    currencyInfo: CurrencyInfo;
    convertPrice: (priceInINR: number) => number;
    formatPrice: (priceInINR: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currency, setCurrencyState] = useState<Currency>(() => {
        const saved = localStorage.getItem('preferred_currency');
        return (saved as Currency) || 'INR';
    });

    const currencyInfo = currencies[currency];

    const setCurrency = (newCurrency: Currency) => {
        setCurrencyState(newCurrency);
        localStorage.setItem('preferred_currency', newCurrency);
    };

    const convertPrice = (priceInINR: number): number => {
        const converted = priceInINR * currencyInfo.conversionRate;

        // Round to appropriate decimal places
        if (currency === 'INR') {
            return Math.round(converted);
        } else {
            return Math.round(converted * 100) / 100; // 2 decimal places
        }
    };

    const formatPrice = (priceInINR: number): string => {
        const converted = convertPrice(priceInINR);

        if (currency === 'INR') {
            return `${currencyInfo.symbol}${converted.toLocaleString('en-IN')}`;
        } else {
            return `${currencyInfo.symbol}${converted.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        }
    };

    return (
        <CurrencyContext.Provider
            value={{
                currency,
                setCurrency,
                currencyInfo,
                convertPrice,
                formatPrice,
            }}
        >
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within CurrencyProvider');
    }
    return context;
};
