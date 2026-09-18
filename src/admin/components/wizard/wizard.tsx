import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Fragment, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import WizardContentRenderer from './components/wizard-content-renderer';
import './wizard.scss';

export interface WizardStepContent {
    type: 'text' | 'image' | 'video' | 'link';
    title?: string;
    content?: string;
    url?: string;
    description?: string;
}

export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    content: WizardStepContent[];
    canSkip: boolean;
}

export interface WizardProps {
    steps: WizardStep[];
    loading?: boolean;
    onComplete?: () => void;
    className?: string;
}

export const Wizard = ({ steps, loading = false, onComplete, className = '' }: WizardProps) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onComplete?.();
        } else {
            setCurrentStepIndex((prev) => prev + 1);
        }
    };

    if (loading) {
        return (
            <div className={cn('w-full min-w-0', className)}>
                <Card className="w-full min-w-0">
                    <CardContent className="flex flex-col gap-6 p-6">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-4 w-16" />
                            <div className="flex flex-1 gap-1">
                                <Skeleton className="h-1 flex-1 rounded-full" />
                                <Skeleton className="h-1 flex-1 rounded-full" />
                                <Skeleton className="h-1 flex-1 rounded-full" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-2/3" />
                        <Skeleton className="h-64 w-full rounded-md" />
                        <div className="flex justify-center gap-2">
                            <Skeleton className="size-11 rounded-full" />
                            <Skeleton className="size-11 rounded-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentStep) return null;

    return (
        <div className={cn('mb-7 w-full min-w-0', className)}>
            <Card className="relative w-full min-w-0 p-4 lg:p-10">
                <CardContent className="flex min-w-0 flex-col gap-6 p-0 sm:p-0">
                    <div className="wizard-step-indicator flex flex-col gap-3">
                        <span className="jetbrains-mono text-sm leading-none font-medium tracking-widest text-primary uppercase">
                            Step {currentStepIndex + 1}/{steps.length}
                        </span>
                        <div className="wizard-step-indicator-progress flex gap-1">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 flex-1 rounded-full transition-colors ${i <= currentStepIndex ? 'bg-primary' : 'bg-muted'}`}
                                />
                            ))}
                        </div>
                    </div>
                    <h4 className="text-xl font-semibold">{currentStep.title}</h4>
                    {currentStep.content.map((content, index) => (
                        <Fragment key={index}>
                            <WizardContentRenderer content={content} />
                        </Fragment>
                    ))}
                </CardContent>

                <div className="wizard-navigation flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon-lg"
                        onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                        disabled={currentStepIndex === 0}
                        className="rounded-full bg-card"
                        aria-label="Previous step"
                    >
                        <ChevronLeftIcon />
                    </Button>
                    <Button
                        size="icon-lg"
                        onClick={handleNext}
                        className="rounded-full"
                        aria-label={isLastStep ? 'Complete' : 'Next step'}
                    >
                        <ChevronRightIcon />
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default Wizard;
