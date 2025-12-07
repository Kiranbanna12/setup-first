import { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectType {
    id: string;
    name: string;
}

interface ProjectTypeComboboxProps {
    value: string;
    onValueChange: (value: string) => void;
}

// Default project types that will be shown when database is empty
const DEFAULT_PROJECT_TYPES = [
    "Reels", "Podcast", "Video", "Documentary", "Short Film",
    "Music Video", "Commercial", "Tutorial", "Vlog", "Animation",
    "Motion Graphics", "Wedding", "Corporate", "Interview", "Product Review",
    "Gaming", "Live Stream", "Trailer", "Behind The Scenes", "Explainer",
    "Social Media Ad", "Event Video", "Webinar", "Course Content", "Unboxing"
];

export function ProjectTypeCombobox({ value, onValueChange }: ProjectTypeComboboxProps) {
    const [open, setOpen] = useState(false);
    const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjectTypes();
    }, []);

    const loadProjectTypes = async () => {
        try {
            const { data, error } = await supabase
                .from('project_types')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                setProjectTypes(data);
            } else {
                // Use defaults if database is empty
                setProjectTypes(DEFAULT_PROJECT_TYPES.map((name, index) => ({
                    id: `default-${index}`,
                    name
                })));
            }
        } catch (error) {
            console.error("Error loading project types:", error);
            // Fallback to defaults
            setProjectTypes(DEFAULT_PROJECT_TYPES.map((name, index) => ({
                id: `default-${index}`,
                name
            })));
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewType = async () => {
        if (!searchValue.trim()) return;

        const typeName = searchValue.trim();
        const exists = projectTypes.some(
            t => t.name.toLowerCase() === typeName.toLowerCase()
        );

        if (exists) {
            toast.error("This type already exists");
            return;
        }

        try {
            const { data, error } = await supabase
                .from('project_types')
                .insert({ name: typeName })
                .select()
                .single();

            if (error) throw error;

            toast.success(`Added "${typeName}" as a new project type`);
            setProjectTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            onValueChange(typeName);
            setSearchValue("");
            setOpen(false);
        } catch (error) {
            console.error("Error adding project type:", error);
            // Add locally if database fails
            const newType = { id: `local-${Date.now()}`, name: typeName };
            setProjectTypes(prev => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)));
            onValueChange(typeName);
            setSearchValue("");
            setOpen(false);
            toast.success(`Added "${typeName}" locally`);
        }
    };

    const filteredTypes = projectTypes.filter(type =>
        type.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    const showAddOption = searchValue.trim() &&
        !projectTypes.some(t => t.name.toLowerCase() === searchValue.trim().toLowerCase());

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-9 text-xs sm:text-sm font-normal"
                >
                    {value || "Select project type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search or add new type..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                        className="h-9"
                    />
                    <CommandList>
                        {loading ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        ) : (
                            <>
                                {filteredTypes.length === 0 && !showAddOption && (
                                    <CommandEmpty>No project type found.</CommandEmpty>
                                )}
                                <CommandGroup>
                                    {filteredTypes.map((type) => (
                                        <CommandItem
                                            key={type.id}
                                            value={type.name}
                                            onSelect={() => {
                                                onValueChange(type.name);
                                                setSearchValue("");
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === type.name ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {type.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                {showAddOption && (
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={handleAddNewType}
                                            className="text-primary"
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add "{searchValue.trim()}"
                                        </CommandItem>
                                    </CommandGroup>
                                )}
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
