import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Person {
    id: string;
    full_name: string;
}

interface InvoiceFiltersProps {
    // Role-based data
    clients?: Person[];
    editors?: Person[];

    // Selected values
    selectedPerson: string;
    onPersonChange: (value: string) => void;
    selectedMonth: string;
    onMonthChange: (value: string) => void;
    availableMonths: string[];

    // User role info
    userCategory?: string;  // 'editor' | 'client'
    isAgency?: boolean;
}

export default function InvoiceFilters({
    clients = [],
    editors = [],
    selectedPerson,
    onPersonChange,
    selectedMonth,
    onMonthChange,
    availableMonths,
    userCategory = 'editor',
    isAgency = false
}: InvoiceFiltersProps) {

    // Determine what to show based on role
    // Editor sees clients, Client sees editors, Agency sees both
    const isEditor = userCategory === 'editor';
    const isClient = userCategory === 'client';

    const showClients = isAgency || isEditor;
    const showEditors = isAgency || isClient;

    // Get appropriate label
    const getFilterLabel = () => {
        if (isAgency) return "Filter by Client/Editor";
        if (isEditor) return "Filter by Client";
        if (isClient) return "Filter by Editor";
        return "Filter by Person";
    };

    // Combine people based on role
    const getPeopleOptions = () => {
        const options: { id: string; name: string; type: string }[] = [];

        if (showClients && clients.length > 0) {
            clients.forEach(c => options.push({ id: c.id, name: c.full_name, type: 'Client' }));
        }

        if (showEditors && editors.length > 0) {
            editors.forEach(e => options.push({ id: e.id, name: e.full_name, type: 'Editor' }));
        }

        return options;
    };

    const peopleOptions = getPeopleOptions();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Person Filter (Role-based) */}
            <div className="space-y-2">
                <Label>{getFilterLabel()}</Label>
                <Select value={selectedPerson} onValueChange={onPersonChange}>
                    <SelectTrigger>
                        <SelectValue placeholder={`All ${isAgency ? 'People' : (isEditor ? 'Clients' : 'Editors')}`} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            All {isAgency ? 'People' : (isEditor ? 'Clients' : 'Editors')}
                        </SelectItem>
                        {peopleOptions.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                                {person.name} {isAgency && <span className="text-muted-foreground">({person.type})</span>}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Month Filter */}
            <div className="space-y-2">
                <Label>Filter by Month</Label>
                <Select value={selectedMonth} onValueChange={onMonthChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {availableMonths.map(month => (
                            <SelectItem key={month} value={month}>
                                {month}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
