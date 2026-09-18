import { ChatEditor } from '@/components/agent-chat/view/agent-chat-composer/chat-editor';

import { useRoutineMentionItems } from '../../hooks/use-routine-mention-items';

import './routine-prompt-editor.scss';

interface Props {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Empty string until the dialog's Agent field has a pick. */
    selectedAgentId: string;
    isErrored: boolean;
}

/** Mentions serialize into the stored `prompt` exactly as chat serializes them into a message. */
const RoutinePromptEditor = ({ id, value, onChange, placeholder, selectedAgentId, isErrored }: Props) => {
    const { items, isPending } = useRoutineMentionItems(selectedAgentId);

    const resolveEmptyLabel = () => {
        if (!selectedAgentId) return 'Pick an agent first';
        if (isPending) return 'Loading suggestions...';

        return undefined;
    };

    return (
        <ChatEditor
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            mentionItems={items}
            mentionEmptyLabel={resolveEmptyLabel()}
            variableHighlight={false}
            ariaInvalid={isErrored}
            className="routine-prompt-editor"
        />
    );
};

export default RoutinePromptEditor;
