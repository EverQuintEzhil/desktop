import type { CapabilityChip, ChipStatus, ConnectorAction } from '../types';

export const IDLE_LABELS: Record<ConnectorAction, string> = {
    connect: 'Connect',
    reconnect: 'Reconnect',
    enable: 'Enable',
};

const PENDING_LABELS: Record<ConnectorAction, string> = {
    connect: 'Connecting to',
    reconnect: 'Reconnecting to',
    enable: 'Enabling',
};

const ERROR_LABELS: Record<ConnectorAction, string> = {
    connect: 'Retry connecting to',
    reconnect: 'Retry reconnecting to',
    enable: 'Retry enabling',
};

export const getChipLabel = (chip: CapabilityChip, status: ChipStatus): string => {
    if (status === 'pending') return `${PENDING_LABELS[chip.action]} ${chip.name}`;
    if (status === 'error') return `${ERROR_LABELS[chip.action]} ${chip.name}`;

    return `${IDLE_LABELS[chip.action]} ${chip.name}`;
};
