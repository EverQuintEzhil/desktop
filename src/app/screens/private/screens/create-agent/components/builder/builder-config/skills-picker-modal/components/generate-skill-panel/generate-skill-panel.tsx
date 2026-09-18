import { ArrowLeftIcon, SparklesIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import { pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { btnCls, GENERATE_SKILL_COLOR, skillBtnCls } from '../../constants';

export interface GenerateSkillPanelProps {
    onGenerateSkill: (description: string) => void;
    onBack: () => void;
    onClose: () => void;
}

const GenerateSkillPanel = ({ onGenerateSkill, onBack, onClose }: GenerateSkillPanelProps) => {
    const [description, setDescription] = useState('');
    const trimmedDescription = description.trim();
    const canGenerate = trimmedDescription.length > 0;

    const handleGenerate = () => {
        if (!canGenerate) return;

        onGenerateSkill(trimmedDescription);
        setDescription('');
        onClose();
    };

    return (
        <>
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', skillBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className={cn('flex size-14 shrink-0 items-center justify-center rounded-[18px] text-white')}
                    style={{ background: GENERATE_SKILL_COLOR }}
                >
                    <SparklesIcon size={22} aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        Create a skill
                    </h3>
                    <span className="truncate text-sm text-text-secondary">
                        Describe a repeatable task and FluentMind will turn it into a reusable skill.
                    </span>
                </div>
                <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>
            <div className={cn('modal-agent-content flex flex-1 flex-col gap-4 px-4 py-6', pickerFormWrapCls)}>
                <div className={cn('rounded-2xl bg-card')}>
                    <label htmlFor="skill-description" className="sr-only">
                        Skill description
                    </label>
                    <textarea
                        id="skill-description"
                        className={cn(
                            'scrollbar-controller scrollbar-vertical min-h-[220px] w-full resize-none rounded-2xl border border-border-secondary p-2 outline-none',
                            'text-sm leading-6 text-(--text-primary) placeholder:text-text-secondary',
                            'transition-colors focus:border-primary',
                        )}
                        placeholder="Example: Summarize uploaded research files into key insights, risks, and recommended next steps."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <div className="flex items-center justify-between gap-4 border-b border-border pb-4 text-xs text-text-secondary">
                        <span>Be specific about the input, output, and tone you expect.</span>
                        <span className="shrink-0 tabular-nums">{trimmedDescription.length} chars</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Card className="flex flex-col gap-1 bg-card p-4 py-4 shadow-none">
                        <span className="text-[11px] font-bold tracking-[0.07em] uppercase">Good prompt</span>
                        <p className="text-sm text-text-secondary">
                            Explain when the skill should run and what result it should produce.
                        </p>
                    </Card>
                    <Card className="flex flex-col gap-1 bg-card p-4 py-4 shadow-none">
                        <span className="text-[11px] font-bold tracking-[0.07em] uppercase">Best results</span>
                        <p className="text-sm text-text-secondary">
                            Mention formats, constraints, tools, or files the skill should consider.
                        </p>
                    </Card>
                </div>
            </div>
            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <div className={pickerFormWrapCls}>
                    <Button
                        className={cn(
                            'mt-auto h-12 w-full justify-center rounded-2xl text-sm font-semibold',
                            'shadow-[0_14px_34px_color-mix(in_srgb,var(--primary)_22%,transparent)]',
                            'disabled:shadow-none',
                        )}
                        disabled={!canGenerate}
                        onClick={handleGenerate}
                    >
                        Generate skill
                    </Button>
                </div>
            </div>
        </>
    );
};

export default GenerateSkillPanel;
