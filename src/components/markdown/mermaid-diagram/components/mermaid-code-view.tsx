import CopyButton from '../../../copy-button';

interface MermaidCodeViewProps {
    sanitizedChart: string;
}

const MermaidCodeView: React.FC<MermaidCodeViewProps> = ({ sanitizedChart }) => (
    <div className="mermaid-code-block">
        <pre>
            <code>{sanitizedChart}</code>
        </pre>
        <CopyButton
            text={sanitizedChart}
            className="mermaid-copy-button bg-card hover:bg-background"
            buttonType="default"
        />
    </div>
);

export default MermaidCodeView;
