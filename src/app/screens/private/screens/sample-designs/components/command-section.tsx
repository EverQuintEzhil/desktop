import { HouseIcon, PlusIcon, SearchIcon, SettingsIcon, UserIcon } from 'lucide-react';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

import { Section } from './shared';

export default function CommandSection() {
    return (
        <Section title="Command" description="Searchable command palette">
            <div className="max-w-sm rounded-lg border">
                <Command>
                    <CommandInput placeholder="Type a command..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Actions">
                            <CommandItem>
                                <PlusIcon className="size-4" />
                                <span>New File</span>
                            </CommandItem>
                            <CommandItem>
                                <SettingsIcon className="size-4" />
                                <span>Settings</span>
                            </CommandItem>
                            <CommandItem>
                                <SearchIcon className="size-4" />
                                <span>Search</span>
                            </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Navigation">
                            <CommandItem>
                                <HouseIcon className="size-4" />
                                <span>Home</span>
                            </CommandItem>
                            <CommandItem>
                                <UserIcon className="size-4" />
                                <span>Profile</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </div>
        </Section>
    );
}
