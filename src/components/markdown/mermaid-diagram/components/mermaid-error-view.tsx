interface MermaidErrorViewProps {
    error: string;
}

const MermaidErrorView: React.FC<MermaidErrorViewProps> = ({ error }) => (
    <div className="mermaid-error-message">
        <span>{error}</span>
    </div>
);

export default MermaidErrorView;
