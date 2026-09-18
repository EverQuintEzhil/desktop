export type ConnectorAction = 'connect' | 'reconnect' | 'enable';
export type CapabilityKind = 'connector' | 'skill';
export type ChipStatus = 'idle' | 'pending' | 'error';

export interface CapabilityChip {
    key: string;
    _id: string;
    name: string;
    kind: CapabilityKind;
    action: ConnectorAction;
}

export type NoAccessKind = 'connector' | 'skill' | 'data-store' | 'tool' | 'agent';

/**
 * An agent capability the viewer cannot use. The backend marks these with `noAccess`
 * on the item itself and keeps them in the agent payload; an absent or false flag
 * means the viewer can use the item, so only `true` reaches this list.
 */
export interface NoAccessCapability {
    key: string;
    _id: string;
    name: string;
    kind: NoAccessKind;
}
