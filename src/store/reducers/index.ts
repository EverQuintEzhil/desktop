import { combineReducers } from '@reduxjs/toolkit';

import headerReducer from './header';
import historyReducer from './history';
import tenantReducer from './tenant';
import userReducer from './user';

const rootReducer = combineReducers({
    tenant: tenantReducer,
    user: userReducer,
    header: headerReducer,
    history: historyReducer,
});

export default rootReducer;
