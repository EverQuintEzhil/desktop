import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface HeaderState {
    isOpen: boolean;
}

const initialState: HeaderState = {
    isOpen: window.innerWidth > 1023,
};

const headerSlice = createSlice({
    name: 'header',
    initialState,
    reducers: {
        setIsOpen(state, action: PayloadAction<boolean>) {
            state.isOpen = action.payload;
        },
        toggleHeader(state) {
            state.isOpen = !state.isOpen;
        },
    },
});

export default headerSlice.reducer;
export const { setIsOpen, toggleHeader } = headerSlice.actions;
