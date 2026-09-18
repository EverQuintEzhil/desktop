/*
 * Design-system public surface.
 *
 * Aggregates the app's own UI primitives into the namespace historically
 * published as `@thefluentmind/design-system`. Two consumers rely on this
 * single surface:
 *   - the GenUI host import map (src/lib/genui/host-import-map.ts), which
 *     federates this namespace to runtime app bundles under the
 *     `@thefluentmind/design-system` specifier, and
 *   - the publishable package (packages/design-system), which re-exports it
 *     for other repos.
 */

export { cn } from '@/lib/utils';

export { Button, buttonVariants } from '@/components/ui/button';
export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
} from '@/components/ui/card';
export { Badge, badgeVariants } from '@/components/ui/badge';
export { Input, type InputProps } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { CheckboxShadcn, Checkbox, type CheckboxProps } from '@/components/ui/checkbox';
export { Separator } from '@/components/ui/separator';
export { Skeleton } from '@/components/ui/skeleton';
export {
    Table,
    TableScrollArea,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
} from '@/components/ui/table';
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from '@/components/ui/tabs';
export { Progress, ProgressBar, type ProgressBarProps } from '@/components/ui/progress';
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
export { Spinner, SpinnerBlade, type SpinnerBladeProps } from '@/components/ui/spinner';
export {
    RadioGroup,
    RadioGroupShadcn,
    RadioGroupItemShadcn,
    RadioButton,
    type RadioGroupProps,
    type RadioButtonProps,
} from '@/components/ui/radio-group';
export {
    TextareaRoot,
    default as TextAreaForm,
    type TextAreaProps,
    type TextAreaFormRef,
} from '@/components/ui/textarea-form';
