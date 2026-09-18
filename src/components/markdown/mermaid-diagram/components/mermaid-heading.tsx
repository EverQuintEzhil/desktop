import { Code2Icon } from 'lucide-react';

const MermaidHeading = () => (
    <div className="mermaid-heading flex items-center gap-1.5">
        <Code2Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="mermaid-heading-label">Mermaid</span>
    </div>
);

export default MermaidHeading;
