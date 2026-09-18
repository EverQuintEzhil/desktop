'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

import {
    AlertDialogSection,
    AvatarSection,
    BadgeSection,
    ButtonSection,
    CalendarSection,
    CheckboxSection,
    CommandSection,
    ConfirmationModalSection,
    DateRangeSection,
    DialogSection,
    DropdownMenuSection,
    InputSection,
    LabelSection,
    MultiSelectSection,
    OtpInputSection,
    PopoverSection,
    ProgressSection,
    RadioSection,
    SelectSection,
    SheetSection,
    SkeletonSection,
    SpinnerSection,
    SwitchSection,
    TagSection,
    TextareaSection,
} from './components';
import './sample-designs.scss';

const SECTIONS = [
    { id: 'button', label: 'Button' },
    { id: 'badge', label: 'Badge' },
    { id: 'input', label: 'Input' },
    { id: 'label', label: 'Label' },
    { id: 'checkbox', label: 'Checkbox' },
    { id: 'radio', label: 'Radio Group' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'progress', label: 'Progress' },
    { id: 'skeleton', label: 'Skeleton' },
    { id: 'tag', label: 'Tag' },
    { id: 'spinner', label: 'Spinner' },
    { id: 'dialog', label: 'Dialog' },
    { id: 'alert-dialog', label: 'Alert Dialog' },
    { id: 'dropdown-menu', label: 'Dropdown Menu' },
    { id: 'select', label: 'Select' },
    { id: 'multi-select', label: 'Multi Select' },
    { id: 'popover', label: 'Popover' },
    { id: 'sheet', label: 'Sheet' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'command', label: 'Command' },
    { id: 'otp-input', label: 'OTP Input' },
    { id: 'textarea', label: 'Textarea' },
    { id: 'date-range', label: 'Date Range' },
    { id: 'confirmation-modal', label: 'Confirmation Modal' },
    { id: 'switch', label: 'Switch' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const SampleDesigns = () => {
    const [activeSection, setActiveSection] = useState<SectionId>('button');

    return (
        <div className="sample-designs flex min-h-svh bg-background">
            <nav className="sample-designs-nav scrollbar-vertical scrollbar-controller flex max-h-svh w-[220px] shrink-0 flex-col gap-4 border-r border-border bg-card p-4">
                <h2 className="sticky top-0 z-1 bg-card text-lg font-semibold text-foreground">UI Components</h2>
                <ul className="flex flex-col gap-1">
                    {SECTIONS.map(({ id, label }) => (
                        <li key={id}>
                            <button
                                type="button"
                                className={cn(
                                    'w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors',
                                    activeSection === id
                                        ? 'bg-primary/10 font-medium text-primary'
                                        : 'text-foreground hover:bg-primary/10',
                                )}
                                onClick={() => setActiveSection(id)}
                            >
                                {label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            <main className="sample-designs-content w-full min-w-0 p-8">
                {activeSection === 'button' && <ButtonSection />}
                {activeSection === 'badge' && <BadgeSection />}
                {activeSection === 'input' && <InputSection />}
                {activeSection === 'label' && <LabelSection />}
                {activeSection === 'checkbox' && <CheckboxSection />}
                {activeSection === 'radio' && <RadioSection />}
                {activeSection === 'avatar' && <AvatarSection />}
                {activeSection === 'progress' && <ProgressSection />}
                {activeSection === 'skeleton' && <SkeletonSection />}
                {activeSection === 'tag' && <TagSection />}
                {activeSection === 'spinner' && <SpinnerSection />}
                {activeSection === 'dialog' && <DialogSection />}
                {activeSection === 'alert-dialog' && <AlertDialogSection />}
                {activeSection === 'dropdown-menu' && <DropdownMenuSection />}
                {activeSection === 'select' && <SelectSection />}
                {activeSection === 'multi-select' && <MultiSelectSection />}
                {activeSection === 'popover' && <PopoverSection />}
                {activeSection === 'sheet' && <SheetSection />}
                {activeSection === 'calendar' && <CalendarSection />}
                {activeSection === 'command' && <CommandSection />}
                {activeSection === 'otp-input' && <OtpInputSection />}
                {activeSection === 'textarea' && <TextareaSection />}
                {activeSection === 'date-range' && <DateRangeSection />}
                {activeSection === 'confirmation-modal' && <ConfirmationModalSection />}
                {activeSection === 'switch' && <SwitchSection />}
            </main>
        </div>
    );
};

export default SampleDesigns;
