import { createSlice } from '@reduxjs/toolkit';

import type { HistoryType } from '@/types/chat';

export interface HistoryState {
    items: HistoryType[];
}

const initialState: HistoryState = {
    items: [],
};

const historySlice = createSlice({
    name: 'history',
    initialState,
    reducers: {
        setHistories: (state, action: { payload: HistoryType[] }) => {
            state.items = action.payload;
        },
        addHistory: (state, action: { payload: HistoryType }) => {
            const i = state.items.findIndex((h) => h._id === action.payload._id);

            if (i >= 0) state.items[i] = action.payload;
            else state.items.push(action.payload);
        },
        updateHistory: (state, action: { payload: HistoryType }) => {
            const i = state.items.findIndex((h) => h._id === action.payload._id);

            if (i >= 0) state.items[i] = action.payload;
        },
    },
});

export const { setHistories, addHistory, updateHistory } = historySlice.actions;
export default historySlice.reducer;
