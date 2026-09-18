import Spinner from '@/components/ui/spinner';

const ChatConversationLoading = () => (
    <div className="spinner-block viewport-height flex w-full items-center justify-center bg-background">
        <Spinner className="scale-150" />
    </div>
);

export default ChatConversationLoading;
