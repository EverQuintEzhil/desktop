import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { UserState } from '@/types/store';

const initialState: UserState = {
    _id: null,
    name: {
        first: null,
        last: null,
        middle: null,
    },
    email: null,
    role: null,
    security_groups: null,
    avatar: null,
    isAuthenticated: false,
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser(state, action: PayloadAction<UserState>) {
            state._id = action.payload._id;
            state.isAuthenticated = action.payload.isAuthenticated;
            state.name = action.payload.name;
            state.email = action.payload.email;
            state.role = action.payload.role;
            state.security_groups = action.payload.security_groups;
            state.avatar = action.payload.avatar;
        },
    },
});

export default userSlice.reducer;
export const { setUser } = userSlice.actions;
