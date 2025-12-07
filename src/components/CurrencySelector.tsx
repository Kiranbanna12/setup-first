import React from 'react';
import { Check, Globe } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useCurrency, currencies, Currency } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';

export const CurrencySelector: React.FC = () => {
    const { currency, setCurrency, currencyInfo } = useCurrency();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">{currencyInfo.flag}</span>
                    <span className="font-semibold">{currency}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {Object.values(currencies).map((curr) => (
                    <DropdownMenuItem
                        key={curr.code}
                        onClick={() => setCurrency(curr.code)}
                        className={cn(
                            'flex items-center justify-between cursor-pointer',
                            currency === curr.code && 'bg-accent'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{curr.flag}</span>
                            <div className="flex flex-col">
                                <span className="font-medium">{curr.code}</span>
                                <span className="text-xs text-muted-foreground">{curr.name}</span>
                            </div>
                        </div>
                        {currency === curr.code && <Check className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
